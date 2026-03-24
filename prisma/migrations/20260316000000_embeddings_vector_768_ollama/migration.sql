-- Switch embeddings to 768 dimensions for Ollama nomic-embed-text.
-- Safe to run on an empty embeddings table.

DROP INDEX IF EXISTS "embeddingIndex";

TRUNCATE TABLE "embeddings";

ALTER TABLE "embeddings" DROP COLUMN "embedding";

ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(768) NOT NULL;

CREATE INDEX IF NOT EXISTS "embeddingIndex"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
