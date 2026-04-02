# AuraAI — Potential Issues & Known Gotchas

This document is a living log of real bugs, near-misses, and architectural risks discovered
during development. Update it whenever a batch surfaces something non-obvious.

---

## How to use this file

- After finishing a batch, ask: *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*
- If yes, add an entry below with context, root cause, and the fix or mitigation applied.
- Keep entries short and actionable — future you (or a new contributor) should be able to read an entry and immediately understand what to watch out for.

---

## Issues log

---

### [Batch 2 / Batch 4] PDF text extraction — sentence splitter fails on table/list content

**Symptom**
Uploading a PDF whose text is dominated by tables, bullet lists, or financial data
(no sentence-ending `.`, `!`, `?` followed by a capital letter) caused Ollama's embedding
model to return:

```
OllamaError: the input length exceeds the context length
```

**Root cause — two-layer problem**

1. `lib/rag/chunking.ts` uses a regex sentence splitter that only breaks on
   `[.!?]+\s+(?=[A-Z…])`. When no such boundary exists, the entire extracted text becomes
   one "sentence". The chunker always includes at least one sentence per chunk, so a
   30 000-char document with no punctuation became a single 30 000-char chunk.

2. More importantly: although Ollama shows `num_ctx 8192` in its model parameters for
   `nomic-embed-text`, the **actual BERT architecture limit is 2 048 tokens**
   (`nomic-bert.context_length: 2048` from `GET /api/show`). BERT's WordPiece tokeniser is
   much denser than GPT-style BPE — Finnish compound words and financial tables can reach
   **~2 chars per token**. A chunk of 6 000 chars can therefore be ~3 000 tokens, far over
   the 2 048 limit.

**Fix applied**
- Added `splitLongSegment()` in `chunking.ts` that caps every segment at **1 500 chars**
  (≈ 750 tokens in the worst case) by splitting at word boundaries.
- Lowered `TARGET_CHUNK_CHARS` from 2 000 → **1 200** to keep assembled chunks safely
  under the BERT context limit even with overlap.

**Watch out for**
- PDFs exported from spreadsheets or databases (pure table data, no prose)
- Finnish / other morphologically-rich languages — WordPiece tokenises them aggressively
- Any upgrade to a different Ollama embedding model: always check
  `model_info["*.context_length"]` from `GET /api/show`, **not** the `num_ctx` parameter
  (which may be a misleading override)
- Never raise `MAX_CHUNK_CHARS` without first verifying the true BERT context length of
  the target model

---

### [Batch 2 / Batch 4] pdf2json Type3 font warnings polluting server logs

**Symptom**
`Warning: Found Type3 font (custom Glyph) - g_font_9_0, trying to decode` spam in the
Next.js dev terminal whenever a PDF with custom glyphs was uploaded.

**Root cause**
pdf2json 4.x binds `console.log` at **module load time**:
```js
te = !Boolean(Number(process?.env?.PDF2JSON_DISABLE_LOGS ?? "0"))
     && "console" in G && "log" in G.console
     ? G.console.log.bind(G.console)
     : function(){};
```
Because `te` captures `console.log` as a bound reference during import, patching
`console.warn` (or even `console.log`) at runtime afterwards has no effect.

**Fix applied**
Set `PDF2JSON_DISABLE_LOGS=1` in `.env` and `.env.example`. This is evaluated before the
module loads and makes the internal logger a no-op. Actual parse errors still surface via
the `pdfParser_dataError` event, so nothing useful is lost.

**Watch out for**
- Upgrading pdf2json — recheck whether the env-var flag still exists in the new version
- Any other pdf2json log that might be useful for debugging real errors will also be
  silenced; check `pdfParser_dataError` events instead

---

### [Batch 4] Ollama availability check adds latency on every sensitive-file upload

**Symptom / risk**
Before embedding a sensitive file, the upload action now calls `checkOllamaReachable()`
(3 s timeout). If Ollama is running locally this is fast (<50 ms), but on a slow network or
with a misconfigured `OLLAMA_BASE_URL` the check adds up to 3 s per file.

**Fix / mitigation**
Not yet optimised — acceptable for now. Future option: cache the result for ~30 s so
repeated uploads in the same session don't each pay the round-trip cost.

---

### [Batch 5] Chat routing pings Ollama on every request with sensitive context

**Symptom / risk**
`resolveChatProvider()` in the chat route calls `checkOllamaReachable()` whenever sensitive
documents appear in the retrieved context. On a slow link this adds up to 3 s to
time-to-first-token for those queries.

**Fix / mitigation**
Not yet optimised. Future option: a short in-memory TTL cache (e.g. 30 s) on the
reachability result so the ping is amortised across many requests.

---

### [Batch 4 → fixed] Per-file embedding provider routing caused dimension mismatch

**Symptom**
```
RAG upload DB error: Error: Vector dimension mismatch: expected 1536, got 768
```

**Root cause**
Batch 4 added per-file sensitive routing that sent sensitive files to Ollama (768-dim) and
non-sensitive files to OpenAI (1536-dim). Both went into the same pgvector column.
pgvector requires every row in a column to share the **same dimension** — this is
impossible to satisfy when two different embedding models are used.

**Design correction (applied)**
Embeddings always use the **global `AI_PROVIDER`** — one consistent vector space for the
entire org. The `sensitive` flag only controls **chat routing** (which model answers the
question), not which model indexes the document.

- `AI_PROVIDER=ollama` → all embeddings are 768-dim, DB column is `vector(768)`
- `AI_PROVIDER=openai` → all embeddings are 1536-dim, DB column is `vector(1536)`

**Migration required when switching providers**
Switching `AI_PROVIDER` requires:
1. A DB migration to change the column dimension (`ALTER TABLE … DROP/ADD COLUMN`)
2. Re-uploading / re-indexing all documents with the new model
3. Never manually set `AI_PROVIDER` to a different value without doing both steps

**Watch out for**
- Changing `AI_PROVIDER` in `.env` without running the migration
- The `forceProvider` mechanism in the upload flow — removed in the fix; do not re-add
  per-file provider overrides for embeddings

---

### [General] `web_search` tool is OpenAI-only

**Risk**
The `web_search` tool (`@ai-sdk/openai`) is injected into the chat route only when
`activeProvider === "openai"`. If routing logic ever passes `"openai"` to `getChatModel`
while `web_search` is disabled (e.g. a future refactor of the tool-injection block), users
will get answers without live web context without any warning.

**Fix / mitigation**
The conditional at line ~300 of `app/api/ai/chat/route.ts` must always stay in sync with
the provider selection logic. Covered by the `[chat] Routing to:` log line — grep for
`Routing to: ollama` if web search seems missing.

---
