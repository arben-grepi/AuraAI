import prisma from "@/lib/prisma";

import { ollama } from 'ai-sdk-ollama';
import { embed } from 'ai';

/** nomic-embed-text (Ollama) output dimension */
const EXPECTED_VECTOR_DIMENSION = 768;

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
  const sanitized = vec.map((v) => {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid vector value: ${v}`);
    }
    return v;
  });
  return `'[${sanitized.join(",")}]'::vector`;
}

/** Minimum similarity (0–1) to include a chunk. Lower = more inclusive for queries like "tell me about me". */
const MIN_SCORE = 0.52;
const MAX_CONTEXT_CHARS = 1200;

export async function retrieveContext(
  query: string,
  topK = 6,
  organizationId?: string | null,
) {
  const trimmed = query?.trim() ?? "";
  if (!trimmed) {
    return { context: "", results: [] };
  }

  const { embedding } = await embed({
    model: ollama.embedding('nomic-embed-text'),
    value: trimmed,
  });

  const qvec = embedding;

  const qvecLit = toPgVectorLiteral(qvec);

  const retrievalLimit = Math.min(Math.max(topK * 4, topK), 24);

  let sqlQuery: string;
  let params: unknown[] = [];

  if (organizationId) {
    sqlQuery = `
      SELECT
        e."content",
        e."resource_id",
        r."name" AS resource_name,
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
        e."content",
        e."resource_id",
        r."name" AS resource_name,
        1 - (e."embedding" <=> ${qvecLit}) AS score
      FROM "embeddings" e
      LEFT JOIN "resources" r ON e."resource_id" = r."id"
      ORDER BY e."embedding" <=> ${qvecLit} ASC
      LIMIT $1;
    `;
    params = [retrievalLimit];
  }

  const rows = await prisma.$queryRawUnsafe<
    { content: string; resource_id: string; resource_name: string | null; score: number }[]
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
