/*
  Warnings:

  - Added the required column `name` to the `resources` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[];
