-- Drop sensitive flag from resources (no longer needed — Ollama-only, all docs are on-premise)
ALTER TABLE "resources" DROP COLUMN IF EXISTS "sensitive";

-- Drop obsolete OpenAI org controls (dual-provider architecture removed in Batch 12)
ALTER TABLE "organization" DROP COLUMN IF EXISTS "openAiEnabled";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "allowSensitiveWithOpenAi";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "openAiTokenBudget";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "openAiTokensUsed";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "openAiTokensResetAt";
