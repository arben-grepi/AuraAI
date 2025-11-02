-- AlterTable
ALTER TABLE "embeddings" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
