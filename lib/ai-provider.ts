import { ollama } from "ai-sdk-ollama";
import { logOps } from "@/lib/ops-log";

/** Server-side ping. Returns true if Ollama responds within the timeout. */
export async function checkOllamaReachable(timeoutMs = 3000): Promise<boolean> {
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const started = performance.now();
  try {
    const res = await fetch(`${baseURL}/api/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      logOps("ollama.health_check", {
        ok: false,
        httpStatus: res.status,
        ms,
        ollamaBaseUrl: baseURL,
      });
    }
    return res.ok;
  } catch (e: unknown) {
    const ms = Math.round(performance.now() - started);
    const err = e instanceof Error ? e : new Error(String(e));
    logOps("ollama.health_check", {
      ok: false,
      errorName: err.name,
      errorMessage: err.message,
      ms,
      ollamaBaseUrl: baseURL,
    });
    return false;
  }
}

export function getChatModel() {
  const model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.1";
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
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
  return ollama.textEmbeddingModel(model, { baseURL: `${baseURL}/api` });
}
