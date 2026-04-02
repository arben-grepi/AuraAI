# AuraAI — Potential Issues & Known Gotchas

This document is a living log of real bugs, near-misses, and architectural risks discovered
during development. Update it whenever a batch surfaces something non-obvious.

---

## How to use this file

- After finishing a batch, ask: *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*
- If yes, add an entry below with context, root cause, and the fix or mitigation applied.
- Keep entries short and actionable — future you (or a new contributor) should be able to read an entry and immediately understand what to watch out for.

---

## Dual-provider architecture overview

AuraAI routes between two AI providers:

| Concern | Who controls it | Rule |
|---|---|---|
| Embedding (indexing documents) | Global `AI_PROVIDER` env var | One provider for the whole deployment — all vectors must share the same dimension |
| Chat answers | `resolveChatProvider()` per request | Routes per request based on sensitivity, budget, org toggle |
| Sensitive data | `sensitive` flag on `resources` | Affects only **chat routing** — sensitive docs are **always** handled by Ollama, never OpenAI |

**The single most important invariant:** Every row in the `embeddings` table must have the same vector dimension. Mixing providers means mixing dimensions (768 Ollama vs 1 536 OpenAI), which pgvector will reject or silently corrupt. One `AI_PROVIDER`, one dimension, always.

**Sensitive data rule:** If a query retrieves any document marked `sensitive = true`, the request is routed to Ollama. If Ollama is unreachable, the request is **blocked** — it will never fall back to OpenAI. This is a hard architectural rule, not a configuration option.

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
- OpenAI `text-embedding-3-small` is a transformer with ~8 192 token limit and BPE
  tokenisation (~4 chars/token) — the chunk sizes that are safe for Ollama are needlessly
  small for OpenAI, but are not harmful

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

### [Batch 4 → design corrected] Per-file embedding provider routing caused vector dimension mismatch

**Symptom**
```
RAG upload DB error: Error: Vector dimension mismatch: expected 1536, got 768
```

**Root cause**
Batch 4 originally added per-file sensitive routing — sensitive files to Ollama (768-dim),
non-sensitive to OpenAI (1 536-dim). Both went into the same pgvector column.
pgvector requires every row to share the **same dimension** — mixing providers is
architecturally impossible.

**Design correction applied**
Embeddings always use the **global `AI_PROVIDER`** — one consistent vector space.
The `sensitive` flag only controls **chat routing** (which model answers questions at query
time), never embedding routing.

- `AI_PROVIDER=ollama` → all embeddings 768-dim, DB column `vector(768)`
- `AI_PROVIDER=openai` → all embeddings 1 536-dim, DB column `vector(1536)`

**Watch out for**
- Changing `AI_PROVIDER` in `.env` without running the dimension migration and re-indexing
- Any future feature that tries to use different embedding models per org or per file

---

### [Batch 4 → fixed] Recovery modal "Switch to Ollama" / "Use OpenAI anyway" were broken

**Symptom**
After the embedding dimension fix, the recovery modal offered retry buttons that silently
did nothing — the backend ignores `forceProvider` and embeddings always use the global
`AI_PROVIDER`.

**Fix applied**
Removed all retry action handlers (`handleRetryWithOllama`, `handleRetryAsNonSensitive`,
`checkOllamaAvailability`). The modal now shows honest **config-level instructions**:

- **QUOTA_EXCEEDED**: "Add OpenAI credits" link + instructions to set `AI_PROVIDER=ollama`
  server-side if switching to Ollama permanently
- **OLLAMA_UNAVAILABLE**: `ollama serve` command to start Ollama + instructions to set
  `AI_PROVIDER=openai` server-side if switching to OpenAI permanently

Users now understand what action is actually needed rather than clicking a button that
silently does nothing.

---

### [General] Switching AI_PROVIDER requires a DB migration AND a full re-index

**Risk**
Changing `AI_PROVIDER` in `.env` without migrating the DB column dimension causes:
1. New uploads succeed (right dimension from new model)
2. Existing embeddings become unreachable (wrong dimension for vector search)
3. Vector search queries fail or return zero results silently

**Correct procedure for switching providers:**
```bash
# 1. Run the appropriate dimension migration
npx prisma db execute --schema prisma/schema.prisma \
  --file prisma/migrations/<timestamp>_embeddings_vector_NNN/migration.sql

# 2. Re-upload / re-index all documents
# (must be done manually through the UI — no automated tool yet)

# 3. Change AI_PROVIDER in .env
# 4. Restart the server
```

**Detection (now automated)**
`lib/rag/search.ts` runs a one-time dimension check on the first hybrid search call:
```
⛔  EMBEDDING DIMENSION MISMATCH DETECTED
   DB column dimension : 768
   AI_PROVIDER expects : 1536 (AI_PROVIDER=openai)
   Vector search will return ZERO results until this is fixed.
```
This fires on first user chat, making a mismatch unmissable in logs.

---

### [General] Vector search query dimension must match stored embeddings

**Risk**
When a chat query is made, `hybridSearch()` generates a query embedding using the current
`AI_PROVIDER`. If stored embeddings were indexed with a different provider (wrong
dimension), pgvector throws:

```
ERROR: different vector dimensions 768 and 1536
```

This kills the retrieval step entirely. The chat route catches it (`preRetrievalResults = []`)
and silently continues with **zero context** — the AI answers without any knowledge base,
with no visible error to the user.

**Fix / mitigation**
The startup check in `lib/rag/search.ts` catches this on first chat. If chat answers seem
wrong or generic despite documents being uploaded, verify dimensions with:
```sql
SELECT vector_dims(embedding) FROM embeddings LIMIT 1;
```
and compare against `AI_PROVIDER`.

---

### [General] Sensitive documents — hard block from OpenAI

**Rule (enforced in code)**
If a chat query retrieves any document with `sensitive = true`, `resolveChatProvider()`
routes to Ollama. If Ollama is unreachable, the request is **blocked** with a clear error
message — it will **never** fall back to OpenAI regardless of any org-level setting.

This is a non-negotiable data protection guarantee. Do not add a fallback path for sensitive
docs to OpenAI.

**What was removed**
The original `allowSensitiveWithOpenAi` org field provided an override that could
allow sensitive docs through to OpenAI when Ollama was down. This override has been
removed from the routing logic — the field still exists in the DB schema but is no
longer consulted for the sensitive-doc routing decision.

**Watch out for**
- Any refactor of `resolveChatProvider()` — ensure the `hasSensitiveDocs` branch always
  results in either `provider: "ollama"` or `blocked: true`. Never `provider: "openai"`.

---

### [General] Chat routing fallback to OpenAI — now visible in UI

**Previous risk**
When `resolveChatProvider()` fell back from Ollama to OpenAI (budget exhausted, OpenAI
disabled toggle, Ollama down), the user had no indication which model generated the response.

**Fix applied**
The active provider (`"openai"` or `"ollama"`) is now included in the stream `messageMetadata`
on each `finish` event. The chat UI reads this and shows a discreet provider badge
(Cloud icon for OpenAI, Cpu icon for Ollama) beneath each completed assistant message.

---

### [General] Token budget never auto-resets until Batch 6 is deployed

**Risk**
The `openAiTokensResetAt` field is added in the Batch 5 migration but the reset logic
is not implemented until Batch 6. Until then:
- Once `openAiTokensUsed >= openAiTokenBudget`, all chats for that org route to Ollama
  **permanently** — the budget never resets
- If Ollama is also down, all chats are blocked

**Fix / mitigation**
Set `openAiTokenBudget = NULL` (no limit) in the DB until Batch 6 is deployed. NULL means
the budget check is skipped. This is the default (`openAiTokenBudget Int?` is nullable).

---

### [General] All orgs share a single embedding dimension

**Risk**
There is one `embeddings` table with one vector column dimension for all organisations.
This means all orgs must use the same embedding model. You cannot have:
- Org A using OpenAI (1 536-dim)
- Org B using Ollama (768-dim)

**Current design decision**
This is intentional — the global `AI_PROVIDER` env var controls the whole deployment.
Per-org provider configuration is explicitly **not supported** for embeddings.

**Watch out for**
- Future multi-tenant deployments where different clients want different providers
- If this ever becomes a requirement, the embeddings table needs a `provider` column and
  pgvector queries must filter by provider — a significant schema change

---

### [Batch 4] Ollama availability check adds latency on uploads and chats with sensitive context

**Symptom / risk**
`checkOllamaReachable()` (3 s timeout) is called:
1. Before every RAG upload (to show the recovery modal if Ollama is down)
2. Inside `resolveChatProvider()` for every chat request that retrieves sensitive docs

On a healthy local setup this is <50 ms. On a slow network or misconfigured
`OLLAMA_BASE_URL` this adds up to 3 s per operation.

**Fix / mitigation**
Not yet optimised. Future option: a short in-memory TTL cache (30 s) on the reachability
result, shared across both the upload route and the chat route.

---

### [General] `web_search` tool is OpenAI-only — silently absent when using Ollama

**Risk**
When routing to Ollama (sensitivity, budget, toggle, or global `AI_PROVIDER=ollama`),
users get no live web search without any warning. They may trust stale answers.

**Fix applied**
Tool injection is now coupled directly to the model object:
```ts
chatModel.provider.startsWith("openai")
```
Cannot drift from routing logic. The provider badge in the UI also makes this visible —
when "Ollama" is shown, users know web search is unavailable.

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
