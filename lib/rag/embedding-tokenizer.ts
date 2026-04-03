import type { PreTrainedTokenizer, Tensor } from "@xenova/transformers";

let tokenizerPromise: Promise<PreTrainedTokenizer | null> | null = null;

/** Test-only: reset cached tokenizer between tests. */
export function resetEmbeddingTokenizerCacheForTests(): void {
  tokenizerPromise = null;
}

/**
 * Hugging Face model id for the tokenizer that matches `OLLAMA_EMBEDDING_MODEL`.
 * Default aligns with Ollama `nomic-embed-text` (same architecture as Xenova port).
 */
export function getHfTokenizerModelId(): string {
  const explicit = process.env.OLLAMA_EMBEDDING_TOKENIZER_ID?.trim();
  if (explicit) return explicit;
  const ollamaModel = (process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text")
    .toLowerCase();
  if (ollamaModel.includes("nomic")) return "Xenova/nomic-embed-text-v1";
  return "Xenova/nomic-embed-text-v1";
}

function tokenizerDisabledByEnv(): boolean {
  return process.env.AURA_DISABLE_EMBEDDING_TOKENIZER === "1";
}

/**
 * Lazy-loads the embedding tokenizer (Transformers.js). Returns null if disabled,
 * if loading fails, or if `AURA_DISABLE_EMBEDDING_TOKENIZER=1` (tests / air-gapped CI).
 */
export async function loadEmbeddingTokenizer(): Promise<PreTrainedTokenizer | null> {
  if (tokenizerDisabledByEnv()) return null;

  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      try {
        const { AutoTokenizer } = await import("@xenova/transformers");
        return await AutoTokenizer.from_pretrained(getHfTokenizerModelId());
      } catch (e) {
        console.error(
          "[chunking] Failed to load embedding tokenizer; using character fallback:",
          e,
        );
        return null;
      }
    })();
  }

  return tokenizerPromise;
}

export function tensorSeqLen(inputIds: Tensor): number {
  const dims = inputIds.dims;
  return dims[dims.length - 1];
}

/** Token count for a string, using the same special tokens as the HF model (matches Ollama embed input). */
export async function countEmbeddingTokens(
  tokenizer: PreTrainedTokenizer,
  text: string,
): Promise<number> {
  const enc = await tokenizer(text);
  return tensorSeqLen(enc.input_ids);
}

const DEFAULT_MARGIN = 64;

/**
 * Hard cap per chunk segment: model max length minus safety margin, optionally clamped by env.
 */
export function resolveMaxChunkTokens(tokenizer: PreTrainedTokenizer): number {
  const raw = process.env.OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 128) return n;
  }
  const maxLen = Number(tokenizer.model_max_length);
  const modelMax = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 8192;
  return Math.max(256, modelMax - DEFAULT_MARGIN);
}

/**
 * Target size when grouping sentences into a chunk (soft limit). Defaults below the hard cap.
 */
export function resolveTargetChunkTokens(maxChunkTokens: number): number {
  const raw = process.env.OLLAMA_EMBEDDING_CHUNK_TARGET_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 64 && n <= maxChunkTokens) return n;
  }
  return Math.max(256, Math.floor(maxChunkTokens * 0.88));
}
