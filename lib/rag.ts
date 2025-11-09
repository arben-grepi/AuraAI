import OpenAI from "openai";
import prisma from "@/lib/prisma";

const EMBED_MODEL = "text-embedding-3-small";
const EXPECTED_VECTOR_DIMENSION = 1536;

function validateVector(vec: number[]): void {
  if (!Array.isArray(vec)) {
    throw new Error("Vector must be an array");
  }
  if (vec.length !== EXPECTED_VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: expected ${EXPECTED_VECTOR_DIMENSION}, got ${vec.length}`,
    );
  }
  for (let i = 0; i < vec.length; i++) {
    const val = vec[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Invalid vector value at index ${i}: ${val}`);
    }
  }
}

function toPgVectorLiteral(vec: number[]): string {
  validateVector(vec);
  // Ensure all numbers are properly formatted (no NaN, Infinity, etc.)
  const sanitized = vec.map((v) => {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid vector value: ${v}`);
    }
    return v;
  });
  return `'[${sanitized.join(",")}]'::vector`;
}

const MIN_SCORE = 0.72;
const MAX_CONTEXT_CHARS = 1200;

export async function retrieveContext(
  query: string,
  topK = 6,
  organizationId?: string | null,
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { data } = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: query,
  });
  const qvec = data[0].embedding as number[];

  const qvecLit = toPgVectorLiteral(qvec);

  const retrievalLimit = Math.min(Math.max(topK * 3, topK), 18);

  let sqlQuery: string;
  let params: unknown[] = [];

  if (organizationId) {
    sqlQuery = `
      SELECT
        e."content",
        e."resource_id",
        1 - (e."embedding" <=> ${qvecLit}) AS score
      FROM "embeddings" e
      JOIN "resources" r ON e."resource_id" = r."id"
      WHERE r."organization_id" = $1
      ORDER BY e."embedding" <=> ${qvecLit} ASC
      LIMIT $2;
    `;
    params = [organizationId, retrievalLimit];
  } else {
    sqlQuery = `
      SELECT
        "content",
        "resource_id",
        1 - ("embedding" <=> ${qvecLit}) AS score
      FROM "embeddings"
      ORDER BY "embedding" <=> ${qvecLit} ASC
      LIMIT $1;
    `;
    params = [retrievalLimit];
  }

  const rows = await prisma.$queryRawUnsafe<
    { content: string; resource_id: string; score: number }[]
  >(sqlQuery, ...params);

  if (!rows.length) {
    return { context: "", results: [] };
  }

  const filtered = rows.filter((row) => row.score >= MIN_SCORE);
  const selected = (filtered.length ? filtered : rows).slice(0, topK);

  const context = selected
    .map((row, index) => {
      const snippet =
        row.content.length > MAX_CONTEXT_CHARS
          ? `${row.content.slice(0, MAX_CONTEXT_CHARS)}…`
          : row.content;

      return `[[${index + 1} | resource:${row.resource_id} | score:${row.score.toFixed(
        3,
      )}]]\n${snippet}`;
    })
    .join("\n\n---\n\n");

  return { context, results: selected };
}
