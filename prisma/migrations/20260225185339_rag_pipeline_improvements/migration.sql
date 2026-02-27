-- DropIndex
DROP INDEX "public"."embeddingIndex";

-- AlterTable
ALTER TABLE "embeddings" ADD COLUMN     "chunk_index" INTEGER,
ADD COLUMN     "end_offset" INTEGER,
ADD COLUMN     "start_offset" INTEGER;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "full_text" TEXT,
ADD COLUMN     "mime_type" TEXT;
