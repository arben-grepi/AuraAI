/*
  Warnings:

  - Added the required column `parts` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."message" ADD COLUMN     "parts" JSONB NOT NULL;
