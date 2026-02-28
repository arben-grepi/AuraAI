-- Switch embeddings to 1536 dimensions (OpenAI text-embedding-3-small).
-- Existing 768-dim rows are removed; new embeddings must be re-generated via upload/ingest.

DROP INDEX IF EXISTS "embeddingIndex";

TRUNCATE TABLE "embeddings";

ALTER TABLE "embeddings" DROP COLUMN "embedding";

ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(1536);

ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "embeddingIndex"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
