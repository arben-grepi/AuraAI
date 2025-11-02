import OpenAI from "openai";
import prisma from "@/lib/prisma";

const EMBED_MODEL = "text-embedding-3-small";

function toPgVectorLiteral(vec: number[]) {
  return `'[${vec.join(",")}]'::vector`;
}

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
    params = [organizationId, topK];
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
    params = [topK];
  }

  const rows = await prisma.$queryRawUnsafe<
    { content: string; resource_id: string; score: number }[]
  >(sqlQuery, ...params);

  const context = rows
    .map(
      (r, i) =>
        `[[${i + 1} | resource:${r.resource_id} | score:${r.score.toFixed(3)}]]\n${r.content}`,
    )
    .join("\n\n---\n\n");

  return { context, results: rows };
}
