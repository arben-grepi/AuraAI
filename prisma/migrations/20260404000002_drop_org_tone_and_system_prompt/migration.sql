-- Remove per-org AI tone and custom system prompt; behaviour is fixed in code (documentation-only assistant).
ALTER TABLE "organization" DROP COLUMN IF EXISTS "tone";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "systemPrompt";
