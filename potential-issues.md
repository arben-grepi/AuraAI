# AuraAI — Potential Issues & Known Gotchas

This document is a living log of real bugs, near-misses, and architectural risks discovered
during development. Update it whenever a batch surfaces something non-obvious.

---

## How to use this file

- After finishing a batch, ask: *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*
- If yes, add an entry below with context, root cause, and the fix or mitigation applied.
- Keep entries short and actionable — future you (or a new contributor) should be able to read an entry and immediately understand what to watch out for.

---

## Architecture overview

AuraAI is **Ollama-only** — all AI work (chat and embeddings) runs on a privately hosted Ollama server. No cloud AI provider is used.

| Concern | Rule |
|---|---|
| Embedding (indexing documents) | Always Ollama (`nomic-embed-text`, 768-dim) |
| Chat answers | Always Ollama; returns 503 if Ollama is unreachable |
| Vector dimension | **768** for every row in `embeddings` — never mix models without a migration |

**The single most important invariant:** Every row in the `embeddings` table must have the same vector dimension. Changing the embedding model without running a dimension migration and re-indexing all documents will cause vector search to return zero results silently.

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

### [Batch 4 — historical] Per-file embedding provider routing caused vector dimension mismatch

**Summary**
Batch 4 originally planned to route sensitive files to Ollama (768-dim) and non-sensitive
to OpenAI (1 536-dim) into the same pgvector column. This caused dimension mismatch errors.
The fix was to use a single global provider for all embeddings.

The product is now Ollama-only, so this is no longer a live concern — but the underlying
rule remains: **every row in `embeddings` must have the same dimension**. Any future change
to the embedding model requires a dimension migration and full re-index.

---

### [General] Switching the Ollama embedding model requires a DB migration AND a full re-index

**Risk**
Changing `OLLAMA_EMBEDDING_MODEL` to a model with a different vector dimension without
migrating the DB column causes:
1. New uploads succeed (right dimension from new model)
2. Existing embeddings become unreachable (wrong dimension for vector search)
3. Vector search queries fail or return zero results silently

**Correct procedure for switching embedding models:**
```bash
# 1. Run a dimension migration (update the vector() column size in schema + migration)
npx prisma migrate dev --name embeddings_vector_NNN

# 2. Re-upload / re-index all documents
# (must be done manually through the UI — no automated tool yet)

# 3. Update OLLAMA_EMBEDDING_MODEL in .env
# 4. Restart the server
```

**Detection (automated)**
`lib/rag/search.ts` runs a one-time dimension check on the first hybrid search call and
logs a prominent warning if the DB column dimension doesn't match the expected size.
This fires on first user chat, making a mismatch unmissable in logs.

---

### [General] Vector search query dimension must match stored embeddings

**Risk**
When a chat query is made, `hybridSearch()` generates a query embedding using the current
`OLLAMA_EMBEDDING_MODEL`. If stored embeddings were indexed with a different model (different
dimension), pgvector throws:

```
ERROR: different vector dimensions 768 and <other>
```

This kills the retrieval step entirely. The chat route catches it (`preRetrievalResults = []`)
and silently continues with **zero context** — the AI answers without any knowledge base,
with no visible error to the user.

**Fix / mitigation**
The dimension check in `lib/rag/search.ts` catches this on first chat. If chat answers seem
wrong or generic despite documents being uploaded, verify dimensions with:
```sql
SELECT vector_dims(embedding) FROM embeddings LIMIT 1;
```
and compare against the expected dimension for `OLLAMA_EMBEDDING_MODEL`.

---

### [General] All orgs share a single embedding model and dimension

**Risk**
There is one `embeddings` table with one vector column dimension for all organisations.
All orgs must use the same Ollama embedding model.

**Current design decision**
This is intentional — `OLLAMA_EMBEDDING_MODEL` is a deployment-wide setting.
Per-org model configuration is explicitly **not supported** for embeddings.

**Watch out for**
- Future multi-tenant deployments where different clients want different models
- If this ever becomes a requirement, the embeddings table needs a `model` column and
  pgvector queries must filter by model — a significant schema change

---

### [General] Ollama availability check adds latency on uploads

**Symptom / risk**
`checkOllamaReachable()` (3 s timeout) is called before every RAG upload to show the
recovery modal if Ollama is down. On a healthy local setup this is <50 ms. On a slow
network or misconfigured `OLLAMA_BASE_URL` this adds up to 3 s per upload.

**Fix / mitigation**
Not yet optimised. Future option: a short in-memory TTL cache (30 s) on the reachability
result.

---

### [Prisma] Manual SQL against the DB creates migration drift

**Symptom**
```
Error: P3006 — Migration failed to apply cleanly to shadow database
```

**Root cause**
Prisma tracks applied migrations in `_prisma_migrations`. Running raw SQL directly changes
the schema without recording a migration. Prisma's shadow database then replays history and
finds a mismatch.

**Fix applied**
Deleted the orphan migration folder. To sync:
```bash
# Option A (dev only — wipes data):
npx prisma migrate reset

# Option B (keep data):
# 1. Delete orphan row from _prisma_migrations
# 2. Apply any remaining diff manually
# 3. npx prisma migrate deploy
```

**Watch out for**
- Never run `ALTER TABLE` directly in dev without creating a proper migration file first
- After any manual SQL, always run `npx prisma migrate status` to check for drift

---
