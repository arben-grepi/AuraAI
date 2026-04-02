-- Switch the embeddings vector column from OpenAI (1536-dim) to Ollama (768-dim).
-- This DROPS all existing embeddings — re-upload documents after running this.
-- If you ever switch back to AI_PROVIDER=openai, create a new migration for vector(1536).

ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(768);

-- Recreate the HNSW index for the new dimension
DROP INDEX IF EXISTS "embeddings_embedding_idx";
CREATE INDEX "embeddings_embedding_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
