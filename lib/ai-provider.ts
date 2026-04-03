import { createOllama } from "ai-sdk-ollama";
import { Agent, fetch as undiciFetch } from "undici";
import { logOps } from "@/lib/ops-log";

/**
 * Max time to wait for Ollama HTTP response headers/body (undici defaults ~300s for headers,
 * which breaks slow local GPUs and cold model loads). AbortSignal alone does not raise this cap.
 * Set `OLLAMA_FETCH_TIMEOUT_MS` (e.g. 900000 = 15 min) for very slow dev machines.
 */
function getOllamaFetchTimeoutMs(): number {
  const raw = process.env.OLLAMA_FETCH_TIMEOUT_MS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 10_000) return n;
  }
  return 1_200_000; // 20 minutes
}

let cachedAgent: Agent | null = null;
let cachedAgentForMs = -1;

function getOllamaAgent(): Agent {
  const ms = getOllamaFetchTimeoutMs();
  if (!cachedAgent || cachedAgentForMs !== ms) {
    cachedAgent?.close();
    cachedAgent = new Agent({
      connectTimeout: 120_000,
      headersTimeout: ms,
      bodyTimeout: ms,
    });
    cachedAgentForMs = ms;
  }
  return cachedAgent;
}

/** Undici fetch with raised headers/body timeouts for Ollama long generations. */
function ollamaUndiciFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return undiciFetch(input as never, {
    ...init,
    dispatcher: getOllamaAgent(),
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
}

let ollamaProvider: ReturnType<typeof createOllama> | null = null;

function getOllamaProvider() {
  if (!ollamaProvider) {
    const base =
      (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(
        /\/$/,
        "",
      );
    ollamaProvider = createOllama({
      baseURL: base,
      fetch: ollamaUndiciFetch,
    });
  }
  return ollamaProvider;
}

/** Server-side ping. Returns true if Ollama responds within the timeout. */
export async function checkOllamaReachable(timeoutMs = 3000): Promise<boolean> {
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const started = performance.now();
  try {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/api/version`, {
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
  return getOllamaProvider()(model);
}

export function getEmbeddingModel() {
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return getOllamaProvider().textEmbeddingModel(model);
}
