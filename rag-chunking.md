# RAG chunking (tokenizer-aware)

This document describes how document and web text is split before embedding, how to verify it in **logs**, and how to **test** it locally.

## What it does

1. **Sentence splitting** — Text is split on punctuation (`. ! ?`) followed by whitespace and a start that looks like a new sentence (capital letter, quote, etc.). Content with no such boundaries (e.g. dense tables) is treated as one long segment.

2. **Long segments** — Any segment that would exceed the embedding model’s **token** budget is split further (binary search on character positions, then word-boundary snapping) so each piece stays under the limit.

3. **Chunk assembly** — Sentences are grouped into chunks up to a **soft** target token count, with a **two-sentence overlap** between consecutive chunks so retrieval does not cut off at arbitrary boundaries.

4. **Offsets** — Each chunk stores `startOffset` / `endOffset` into the original string for source highlighting. Callers pass **trimmed** text so offsets align with the string that was chunked.

## Token path vs character fallback

| Mode | When | Limits |
|------|------|--------|
| **`tokenizer`** | Default in production: Transformers.js loads the Hugging Face tokenizer for your embedding model (default HF id: `Xenova/nomic-embed-text-v1`, aligned with Ollama `nomic-embed-text`). | Hard cap ≈ `model_max_length − 64` tokens per segment; soft grouping target ≈ **88%** of that cap (override with env vars below). |
| **`chars_fallback`** | `AURA_DISABLE_EMBEDDING_TOKENIZER=1`, or tokenizer **import/load fails** (see stderr). | Same as before tokenizer work: ~**1200** chars target per chunk group, **1500** char hard cap per long segment. |

If loading fails, the server logs:

```text
[chunking] Failed to load embedding tokenizer; using character fallback:
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OLLAMA_EMBEDDING_MODEL` | Ollama embedding model name (default `nomic-embed-text`). Used to pick a default HF tokenizer id when `OLLAMA_EMBEDDING_TOKENIZER_ID` is unset. |
| `OLLAMA_EMBEDDING_TOKENIZER_ID` | Explicit Hugging Face tokenizer repo id (e.g. `Xenova/nomic-embed-text-v1`). Set this when you change the embedding model. |
| `OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS` | Hard max tokens per segment (optional; must be ≥ 128 if set). |
| `OLLAMA_EMBEDDING_CHUNK_TARGET_TOKENS` | Soft target for grouping sentences (optional; must be ≤ max and ≥ 64). |
| `AURA_DISABLE_EMBEDDING_TOKENIZER` | Set to `1` to force character fallback (tests, debugging, air-gapped CI). |

See also `.env.example`.

## How to see it in logs

Every successful chunking run emits **one JSON line** to stdout (same mechanism as other ops logs). Search for the event name:

```bash
# dev terminal or container logs
grep 'rag.chunking.complete' 
```

Example (tokenizer active):

```json
{"ts":"2026-04-03T12:00:00.000Z","event":"rag.chunking.complete","chunkingMode":"tokenizer","hfTokenizerId":"Xenova/nomic-embed-text-v1","maxChunkTokens":8128,"targetChunkTokens":7152,"chunkCount":3,"inputChars":45000}
```

Example (fallback):

```json
{"ts":"2026-04-03T12:00:00.000Z","event":"rag.chunking.complete","chunkingMode":"chars_fallback","chunkCount":12,"inputChars":45000}
```

**How to interpret**

- **`chunkingMode":"tokenizer"`** — Token-based sizing is active; `maxChunkTokens` / `targetChunkTokens` are the limits in effect.
- **`chunkingMode":"chars_fallback"`** — Either the tokenizer is disabled or failed to load; if you did not set `AURA_DISABLE_EMBEDDING_TOKENIZER=1`, check for the `[chunking] Failed to load embedding tokenizer` error above.
- **`chunkCount`** — Number of embedding chunks produced. For the **same** document, tokenizer mode usually produces **fewer, larger** chunks than char fallback (more tokens per chunk).
- File upload also logs **`rag.upload.embed_start`** with `chunkCount` — you can correlate the same upload with `rag.chunking.complete` in the same request.

## How to test

### 1. Unit tests (char fallback)

Jest does not load `@xenova/transformers` reliably; tests force the char path:

```bash
npm test -- --testPathPattern=chunking
```

### 2. Manual test in dev (tokenizer path)

1. Ensure **`AURA_DISABLE_EMBEDDING_TOKENIZER` is unset** (or not `1`).
2. Run `npm run dev`, upload a medium-sized PDF or text file.
3. In the server log, confirm **`"chunkingMode":"tokenizer"`** in `rag.chunking.complete`.
4. Optionally compare **`chunkCount`** with the same file and `AURA_DISABLE_EMBEDDING_TOKENIZER=1` — count should typically **drop** when the tokenizer is on (fewer chunks per document).

### 3. Force fallback to compare behaviour

```bash
AURA_DISABLE_EMBEDDING_TOKENIZER=1 npm run dev
```

Upload the same file; logs should show **`chunkingMode":"chars_fallback"`**.

### 4. Integration / production checks

- After a model or tokenizer change, upload a file that previously hit **context length** errors; embedding should succeed.
- If Ollama’s **real** embed limit is lower than the tokenizer’s `model_max_length`, set **`OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS`** explicitly and re-test.

## Re-indexing old documents

Chunks created **before** tokenizer-aware sizing were smaller (character caps). New uploads use larger token-based chunks. Search still works for both; for consistent retrieval quality across the corpus, consider re-uploading or re-indexing important sources after enabling the tokenizer path.

## Code map

| File | Role |
|------|------|
| `lib/rag/chunking.ts` | Sentence split, token/char limits, overlap, `rag.chunking.complete` log |
| `lib/rag/embedding-tokenizer.ts` | Lazy HF tokenizer load, `countEmbeddingTokens`, env-based limits |
| `lib/rag/upload/actions.ts` | File upload → `chunkContentWithOffsets` → embeddings |
| `app/api/org/sources/index/route.ts` | Web indexing → same chunking pipeline |
