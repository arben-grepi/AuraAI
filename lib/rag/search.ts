import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "./embeddings";

/** Row shape returned by the vector similarity query. */
type SearchRow = {
  id: string;
  content: string;
  resource_id: string;
  resource_name: string | null;
  score: number;
};

/**
 * Converts a number array to a pgvector literal string for raw SQL.
 * @param vec - Embedding vector
 * @returns String representation for casting to `::vector`
 */
function toVectorParam(vec: number[]): string {
  const cleaned = vec.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${cleaned.map((n) => n.toFixed(8)).join(",")}]`;
}

/**
 * Searches embeddings by semantic similarity using cosine distance (pgvector).
 * Equivalent to Drizzle's cosineDistance: similarity = 1 - cosineDistance.
 *
 * @param query - Search query text
 * @param limit - Max number of results (default 5)
 * @param threshold - Minimum similarity score 0–1 (default 0.5)
 * @param organizationId - Optional org filter; omit for all orgs
 * @returns Matching rows with id, content, resource_id, resource_name, score
 */
export async function searchDocuments(
  query: string,
  limit = 5,
  threshold = 0.5,
  organizationId?: string | null,
): Promise<SearchRow[]> {
  if (!organizationId) {
    return [];
  }
  const trimmed = query?.trim() ?? "";
  if (!trimmed) return [];

  const embedding = await generateEmbedding(trimmed);
  const vecParam = toVectorParam(embedding);

  const safeLimit = Math.min(Math.max(1, limit), 50);

  const rows = (await prisma.$queryRaw(Prisma.sql`
    SELECT
      e."id",
      e."content",
      e."resource_id",
      r."name" AS resource_name,
      (1 - (e."embedding" <=> ${vecParam}::vector)) AS score
    FROM "embeddings" e
    JOIN "resources" r ON e."resource_id" = r."id"
    WHERE (1 - (e."embedding" <=> ${vecParam}::vector)) >= ${threshold}
      AND (${organizationId ?? null}::text IS NULL OR r."organization_id" = ${organizationId ?? null}::text)
    ORDER BY e."embedding" <=> ${vecParam}::vector ASC
    LIMIT ${safeLimit};
  `)) as SearchRow[];

  return rows;
}
