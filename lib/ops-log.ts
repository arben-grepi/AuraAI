import { randomUUID } from "crypto";

/** Values safe for structured logs — no message bodies or document text. */
export type OpsScalar = string | number | boolean | null | undefined;

/**
 * Prefer client-provided `x-request-id` for tracing; otherwise generate a UUID.
 */
export function getCorrelationId(req: Request): string {
  const h = req.headers.get("x-request-id")?.trim();
  return h && h.length > 0 ? h : randomUUID();
}

export function getOllamaModelsForLog(): {
  ollamaBaseUrl: string;
  ollamaChatModel: string;
  ollamaEmbeddingModel: string;
} {
  return {
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaChatModel: process.env.OLLAMA_CHAT_MODEL ?? "llama3.1",
    ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
  };
}

/** Single-line JSON for grep / log pipelines; never include user text or KB content. */
export function logOps(event: string, fields: Record<string, OpsScalar>): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...fields,
    }),
  );
}
