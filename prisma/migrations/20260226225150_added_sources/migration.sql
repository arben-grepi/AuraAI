-- DropIndex
DROP INDEX "public"."embeddingIndex";

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "sources" TEXT[] DEFAULT ARRAY[]::TEXT[];
