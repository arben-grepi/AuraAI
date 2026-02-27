-- Switch embeddings to 768 dimensions (Ollama nomic-embed-text).
-- Existing 1536-dim rows are removed; new embeddings must be created via upload/ingest.

DROP INDEX IF EXISTS "embeddingIndex";

TRUNCATE TABLE "embeddings";

ALTER TABLE "embeddings" DROP COLUMN "embedding";

ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(768);

ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "embeddingIndex"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
