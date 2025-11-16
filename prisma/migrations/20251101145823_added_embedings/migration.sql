-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;


-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "embeddingIndex"
  ON "embeddings" USING hnsw (embedding vector_cosine_ops);
