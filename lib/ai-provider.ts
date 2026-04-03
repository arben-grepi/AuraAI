import { ollama } from "ai-sdk-ollama";

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

export function getChatModel() {
  const model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.1";
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  console.log(`[ai-provider] Chat model: ollama/${model} (${baseURL})`);
  return ollama(model, {
    baseURL: `${baseURL}/api`,
    // llama3.1 can take several minutes to generate the first token on first load.
    // undici's default header timeout is 300 s — raise it so slow local hardware
    // doesn't kill the stream before the model starts responding.
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min
      }),
  });
}

export function getEmbeddingModel() {
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  console.log(`[ai-provider] Embedding model: ollama/${model} (${baseURL})`);
  return ollama.textEmbeddingModel(model, { baseURL: `${baseURL}/api` });
}
