/*
  Warnings:

  - Made the column `embedding` on table `embeddings` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."embeddings_embedding_idx";

-- AlterTable
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET NOT NULL;
