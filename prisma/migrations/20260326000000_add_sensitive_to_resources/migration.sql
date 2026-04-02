-- Add sensitive flag to resources table
ALTER TABLE "resources" ADD COLUMN "sensitive" BOOLEAN NOT NULL DEFAULT false;
