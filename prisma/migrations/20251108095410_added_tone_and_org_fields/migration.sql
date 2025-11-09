/*
  Warnings:

  - Added the required column `backgroundColor` to the `organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buttonColor` to the `organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "backgroundColor" TEXT NOT NULL,
ADD COLUMN     "buttonColor" TEXT NOT NULL,
ADD COLUMN     "tone" TEXT;
