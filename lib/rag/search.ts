import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "./embeddings";
import { getExpectedVectorDimension } from "./vector";

// ---------------------------------------------------------------------------
// Startup dimension integrity check
// Runs once on the first search call. If AI_PROVIDER has been changed without
// running the matching DB migration, vector search will silently return zero
// results. This check catches it early with an unmissable log warning.
// ---------------------------------------------------------------------------

let dimensionCheckDone = false;

async function checkDimensionIntegrity(): Promise<void> {
  if (dimensionCheckDone) return;
  dimensionCheckDone = true;

  try {
    const row = await prisma.$queryRaw<{ dims: number }[]>`
      SELECT vector_dims(embedding) AS dims FROM embeddings LIMIT 1
    `;
    if (!row.length) return; // no embeddings yet — nothing to check

    const actual = row[0].dims;
    const expected = getExpectedVectorDimension();

    if (actual !== expected) {
      console.error(
        `\n⛔  EMBEDDING DIMENSION MISMATCH DETECTED\n` +
        `   DB column dimension : ${actual}\n` +
        `   AI_PROVIDER expects : ${expected} (AI_PROVIDER=${process.env.AI_PROVIDER ?? "openai"})\n` +
        `   Vector search will return ZERO results until this is fixed.\n` +
        `   Fix: run the matching dimension migration and re-upload all documents.\n`,
      );
    } else {
      console.log(
        `[search] Dimension check OK — embeddings are ${actual}-dim ` +
        `(AI_PROVIDER=${process.env.AI_PROVIDER ?? "openai"})`,
      );
    }
  } catch {
    // Non-fatal — if the table is empty or the query fails, skip the check
  }
}

/** Row shape returned by search queries. */
export type SearchRow = {
  id: string;
  content: string;
  resource_id: string;
  resource_name: string | null;
  score: number;
  start_offset: number | null;
  end_offset: number | null;
  tags: string[] | null;
  sensitive: boolean;
};

/**
 * Converts a number array to a pgvector literal string for raw SQL.
 */
function toVectorParam(vec: number[]): string {
  const cleaned = vec.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${cleaned.map((n) => n.toFixed(8)).join(",")}]`;
}

// ---------------------------------------------------------------------------
// Vector search (cosine similarity via pgvector)
// ---------------------------------------------------------------------------

export async function vectorSearch(
  query: string,
  limit: number,
  threshold: number,
  organizationId: string,
): Promise<SearchRow[]> {
  const embedding = await generateEmbedding(query);
  const vecParam = toVectorParam(embedding);
  const safeLimit = Math.min(Math.max(1, limit), 50);

  return (await prisma.$queryRaw(Prisma.sql`
    SELECT
      e."id",
      e."content",
      e."resource_id",
      r."name" AS resource_name,
      e."start_offset",
      e."end_offset",
      r."tags",
      r."sensitive",
      (1 - (e."embedding" <=> ${vecParam}::vector)) AS score
    FROM "embeddings" e
    JOIN "resources" r ON e."resource_id" = r."id"
    WHERE (1 - (e."embedding" <=> ${vecParam}::vector)) >= ${threshold}
      AND r."organization_id" = ${organizationId}::text
    ORDER BY e."embedding" <=> ${vecParam}::vector ASC
    LIMIT ${safeLimit};
  `)) as SearchRow[];
}

// ---------------------------------------------------------------------------
// Keyword search (PostgreSQL tsvector/tsquery full-text search)
// ---------------------------------------------------------------------------

async function keywordSearch(
  query: string,
  limit: number,
  organizationId: string,
): Promise<SearchRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 50);

  // plainto_tsquery handles user input safely (no special syntax required)
  return (await prisma.$queryRaw(Prisma.sql`
    SELECT
      e."id",
      e."content",
      e."resource_id",
      r."name" AS resource_name,
      e."start_offset",
      e."end_offset",
      r."tags",
      r."sensitive",
      ts_rank(to_tsvector('english', e."content"), plainto_tsquery('english', ${query})) AS score
    FROM "embeddings" e
    JOIN "resources" r ON e."resource_id" = r."id"
    WHERE r."organization_id" = ${organizationId}::text
      AND to_tsvector('english', e."content") @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${safeLimit};
  `)) as SearchRow[];
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion (RRF)
// ---------------------------------------------------------------------------

const RRF_K = 60; // standard RRF constant

function reciprocalRankFusion(
  vectorResults: SearchRow[],
  keywordResults: SearchRow[],
  limit: number,
): SearchRow[] {
  const scoreMap = new Map<string, { row: SearchRow; rrfScore: number }>();

  // Score from vector results
  vectorResults.forEach((row, rank) => {
    const existing = scoreMap.get(row.id);
    const rrfIncrement = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfIncrement;
    } else {
      scoreMap.set(row.id, { row, rrfScore: rrfIncrement });
    }
  });

  // Score from keyword results
  keywordResults.forEach((row, rank) => {
    const existing = scoreMap.get(row.id);
    const rrfIncrement = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfIncrement;
    } else {
      scoreMap.set(row.id, { row, rrfScore: rrfIncrement });
    }
  });

  return [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((entry) => ({ ...entry.row, score: entry.rrfScore }));
}

// ---------------------------------------------------------------------------
// Simple reranking — boost results with high word overlap with query
// ---------------------------------------------------------------------------

function rerank(results: SearchRow[], query: string): SearchRow[] {
  const stopWords = new Set([
    "what", "is", "the", "a", "an", "and", "or", "but", "in", "on", "at",
    "to", "for", "of", "with", "by", "from", "as", "are", "was", "were",
    "been", "be", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "this", "that",
    "how", "why", "when", "where", "who", "which", "about",
  ]);

  const queryWords = new Set(
    query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w)),
  );

  if (queryWords.size === 0) return results;

  return results
    .map((row) => {
      const chunkWords = new Set(
        row.content
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2),
      );
      const intersection = [...queryWords].filter((w) => chunkWords.has(w))
        .length;
      const jaccard =
        intersection / (queryWords.size + chunkWords.size - intersection);
      // Blend: 70% RRF score, 30% keyword overlap
      return { ...row, score: row.score * 0.7 + jaccard * 0.3 };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Hybrid search: vector + keyword → RRF → rerank
// ---------------------------------------------------------------------------

export async function hybridSearch(
  query: string,
  limit: number,
  organizationId: string,
  vectorThreshold = 0.3,
): Promise<SearchRow[]> {
  if (!organizationId || !query?.trim()) return [];

  // Fire-and-forget on first call — does not block the search
  checkDimensionIntegrity().catch(() => {});

  const fetchLimit = limit * 2; // fetch more candidates for fusion

  const [vecResults, kwResults] = await Promise.all([
    vectorSearch(query, fetchLimit, vectorThreshold, organizationId),
    keywordSearch(query, fetchLimit, organizationId).catch(() => {
      // Keyword search may fail if content has unusual characters; degrade gracefully
      return [] as SearchRow[];
    }),
  ]);

  const fused = reciprocalRankFusion(vecResults, kwResults, limit);
  return rerank(fused, query);
}

// ---------------------------------------------------------------------------
// Legacy API — kept for backwards compat with the retrieve_context tool
// ---------------------------------------------------------------------------

export async function searchDocuments(
  query: string,
  limit = 5,
  vectorThreshold = 0.5,
  organizationId?: string | null,
): Promise<SearchRow[]> {
  if (!organizationId) return [];
  return hybridSearch(query, limit, organizationId, vectorThreshold);
}
