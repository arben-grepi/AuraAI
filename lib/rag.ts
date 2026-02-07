import { ollama } from "ai-sdk-ollama";
import { embed } from "ai";
import { Prisma } from "@/app/generated/prisma";
import prisma from "./prisma";

// function validateVector(vec: number[]): void {
//   if (!Array.isArray(vec)) {
//     throw new Error("Vector must be an array");
//   }
//   if (vec.length !== EXPECTED_VECTOR_DIMENSION) {
//     throw new Error(
//       `Vector dimension mismatch: expected ${EXPECTED_VECTOR_DIMENSION}, got ${vec.length}`,
//     );
//   }
//   for (let i = 0; i < vec.length; i++) {
//     const val = vec[i];
//     if (typeof val !== "number" || !Number.isFinite(val)) {
//       throw new Error(`Invalid vector value at index ${i}: ${val}`);
//     }
//   }
// }

// function toPgVectorLiteral(vec: number[]): string {
//   validateVector(vec);
//   const sanitized = vec.map((v) => {
//     if (!Number.isFinite(v)) {
//       throw new Error(`Invalid vector value: ${v}`);
//     }
//     return v;
//   });
//   return `'[${sanitized.join(",")}]'::vector`;
// }

const MAX_CONTEXT_CHARS = 1200;
const MAX_CANDIDATES_CAP = 48;
const MIN_SCORE_BEST = 0.58;
const MIN_SCORE_ITEM = 0.48;

type RetrieveRow = {
  content: string;
  resource_id: string;
  resource_name: string | null;
  score: number;
};

function toVectorParam(vec: number[]) {
  const cleaned = vec.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${cleaned.map((n) => n.toFixed(8)).join(",")}]`;
}

export async function retrieveContext(
  query: string,
  topK = 6,
  organizationId?: string | null,
) {
  const trimmed = query?.trim() ?? "";
  if (!trimmed) return { context: "", results: [] as RetrieveRow[] };

  const safeTopK = Math.min(Math.max(1, topK), 20);
  const retrievalLimit = Math.min(Math.max(safeTopK * 6, safeTopK), MAX_CANDIDATES_CAP);

  const { embedding } = await embed({
    model: ollama.embedding("nomic-embed-text"),
    value: trimmed,
  });

  const vecParam = toVectorParam(embedding);

  const rows = (await prisma.$queryRaw(Prisma.sql`
    SELECT
      e."content",
      e."resource_id",
      r."name" AS resource_name,
      (1 - (e."embedding" <=> ${vecParam}::vector)) AS score
    FROM "embeddings" e
    JOIN "resources" r ON e."resource_id" = r."id"
    WHERE (${organizationId ?? null}::text IS NULL OR r."organization_id" = ${organizationId ?? null}::text)
    ORDER BY e."embedding" <=> ${vecParam}::vector ASC
    LIMIT ${retrievalLimit};
  `)) as RetrieveRow[];

  if (!rows.length) return { context: "", results: [] };

  const bestScore = rows[0]?.score ?? 0;
  if (bestScore < MIN_SCORE_BEST) {
    return { context: "", results: [] };
  }

  const strong = rows.filter((r) => r.score >= MIN_SCORE_ITEM);
  const selected = (strong.length ? strong : rows).slice(0, safeTopK);

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