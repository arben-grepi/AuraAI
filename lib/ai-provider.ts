import { openai } from "@ai-sdk/openai";
import { ollama } from "ai-sdk-ollama";

export type AiProvider = "openai" | "ollama";

/** Server-side ping. Returns true if Ollama responds within the timeout. */
export async function checkOllamaReachable(timeoutMs = 3000): Promise<boolean> {
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  try {
    const res = await fetch(`${baseURL}/api/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getActiveProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "openai";
  if (provider !== "openai" && provider !== "ollama") {
    console.warn(
      `[ai-provider] Unknown AI_PROVIDER value "${provider}", falling back to "openai"`,
    );
    return "openai";
  }
  return provider;
}

export function getChatModel(provider: AiProvider = getActiveProvider()) {
  if (provider === "ollama") {
    const model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.1";
    const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    console.log(`[ai-provider] Chat model: ollama/${model} (${baseURL})`);
    return ollama(model, { baseURL: `${baseURL}/api` });
  }
  const model = "gpt-4o-mini";
  console.log(`[ai-provider] Chat model: openai/${model}`);
  return openai(model);
}

export function getEmbeddingModel(provider: AiProvider = getActiveProvider()) {
  if (provider === "ollama") {
    const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
    const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    console.log(`[ai-provider] Embedding model: ollama/${model} (${baseURL})`);
    return ollama.textEmbeddingModel(model, { baseURL: `${baseURL}/api` });
  }
  console.log(`[ai-provider] Embedding model: openai/text-embedding-3-small`);
  return openai.embedding("text-embedding-3-small");
}
