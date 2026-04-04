# AuraAI — Implementation Plan

This document is the single source of truth for planned development batches.
Each batch is independently testable before moving to the next.
Check the box when a batch is fully done.

### Standing rule — potential issues live **in this file, under each batch**

Before marking a batch ✅ Done, ask:
> *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*

If yes — or even if it was a close call — add a short entry under **that batch’s `### Potential issues`** subsection below (symptom, root cause, fix, watch-outs). Cross-cutting risks that are not specific to one batch go under [Notes → Cross-cutting potential issues](#cross-cutting-potential-issues).

---

## Overview

- All AI work (chat + embeddings) runs on **Ollama** — privately hosted, fully on-premise.
- No OpenAI API keys, no cloud routing, no token budgets.
- Email deliverability: verify a sending domain so invites + verification emails can reach any recipient.
- Invite-only member onboarding (remove admin-created accounts).
- Clean up leftover dual-provider DB fields and the `sensitive` flag (no longer needed — everything is on-premise by default).
- Chat answers are **documentation-grounded only** — no configurable tone, no custom org system prompt; the model must cite sources and not substitute general knowledge (see Batch 14).

**Next recommended:** **Batch 15** — default to a **smaller / faster** Ollama chat model (lower latency), with switching still **env-only** via `OLLAMA_CHAT_MODEL`. Does not change embeddings (`nomic-embed-text`). See [Batch 15](#batch-15-smaller-default-ollama-chat-model-env-driven) below.

---

## Batch 1: Ollama provider infrastructure ✅

**Goal:** Get Ollama running end-to-end and create a provider factory used by both chat and embeddings.

### What was done

- [x] `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL` added to `.env.example`
- [x] `lib/ai-provider.ts` — `getChatModel()` and `getEmbeddingModel()` factory functions
- [x] `lib/rag/embeddings.ts` — uses `getEmbeddingModel()` (provider-aware)
- [x] DB migration: embeddings column switched to `vector(768)` (nomic-embed-text), HNSW index recreated
- [x] Chat route uses `getActiveProvider()` / `getChatModel()`, logs `[chat] Provider: ...`

### Still needed to fully close
- [x] Re-index existing documents — database was wiped clean, no re-indexing needed

### Potential issues

- **Vector dimension invariant:** Every row in `embeddings` must use the same dimension (768 for `nomic-embed-text`). Switching `OLLAMA_EMBEDDING_MODEL` without a migration and full re-index breaks hybrid search; see **Notes → Cross-cutting potential issues**.

---

## Batch 2: Document sensitivity flag ✅ (superseded — see Batch 13)

**Goal:** Mark documents as sensitive at upload time. Surface that flag in search results.

> **Architecture note:** This flag was originally intended to control chat routing (sensitive → Ollama, non-sensitive → OpenAI). Since the product is now **Ollama-only**, every document is processed entirely on-premise regardless of this flag. The `sensitive` column, UI toggle, and routing logic are scheduled for removal in **Batch 13**.

- [x] DB migration — add `sensitive boolean NOT NULL DEFAULT false` to `resources` table
- [x] Upload UI — "Sensitive document" toggle in `components/org/org-files-list.tsx`
- [x] `lib/rag/upload/actions.ts` — accept and store `sensitive` in `processRagFile`
- [x] `lib/rag/search.ts` — add `r."sensitive"` to both `vectorSearch` and `keywordSearch`; update `SearchRow` type
- [x] UX copy — toggle shows: "This file contains confidential data. It will be processed only by the on-premise AI model — never sent to the cloud."

### Potential issues

- The `sensitive` column and UI were **removed in Batch 13**; this batch is superseded.
- PDF / table chunking and context-length caveats are recorded under **Batch 4** and **Batch 10** (not repeated here).

---

## Batch 3: UI — scrollable layouts, unified CSS, org colour system ✅

**Goal:** Every screen is scrollable when content overflows, layouts are responsive across all viewports, and organization brand colours are applied consistently throughout the app.

### Scrollable layouts

- [x] Audit every Dialog/Sheet/panel — ensure they use `overflow-y-auto` with a `max-h-*` or `max-h-[calc(100vh-...)]` so content never clips off screen (confirmed broken: file upload dialog, user invite dialog, create-org steps)
- [x] Admin org settings page — whole page should scroll, not clip sections
- [x] Org chat layout — message list scrolls independently; sidebar never clips action buttons at the bottom
- [x] All modals/dialogs: header + footer pinned, body scrolls (`flex flex-col` + `overflow-y-auto flex-1` pattern)

### Responsive / scalable CSS

- [x] Establish a single container pattern used everywhere: `max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8`
- [x] Remove hard-coded `w-[...]` / `h-[...]` / `px-25` values that break on small screens; replace with Tailwind scale
- [x] Admin panel pages — sidebar + content area stack correctly on narrow screens
- [x] Forms (sign-in, sign-up, create-org steps) — centered + max-width on wide screens, full-width on small
- [x] File list — tags wrap cleanly, no horizontal overflow on small viewports
- [x] Typography — use `text-sm` / `text-base` / `text-lg` consistently; remove raw `text-[14px]` overrides

### Organisation colour system

- [x] Define org brand colours as CSS custom properties on the org layout root (`--org-bg`, `--org-btn`) from the org's `backgroundColor` / `buttonColor` DB fields
- [x] Replace all inline `style={{ backgroundColor: org.buttonColor }}` scattered across components with a single `bg-[var(--org-btn)]` / `bg-[var(--org-bg)]` utility class
- [x] Ensure org colours apply to: chat send button, sidebar active state, org header/banner — and nowhere else (avoid org colours leaking into admin UI)
- [x] Verify org colours meet WCAG AA contrast against white text; add a contrast-check helper or note in code

### Other

- [x] Remove duplicate `<p>Upload</p>` button label in `org-files-list.tsx` (renders "Upload Upload")
- [x] Remove any unused inline `style={{}}` props that duplicate Tailwind utilities
- [x] Dark/light mode — confirm Tailwind CSS variables propagate correctly on all org-facing components

### Test plan

- Open file upload dialog with many files selected — body scrolls, header/footer stay pinned
- Open invite dialog with a long list — same scroll behaviour
- Resize browser from 375 px to 1440 px on each major page — no horizontal scrollbar, no clipped elements
- Create an org with a custom colour — verify it appears only on the correct elements and admin UI is unaffected

### Potential issues

- *No entries migrated from the legacy log.*

---

## Batch 4: Upload UX and provider error surfacing ✅

**Goal:** Make document upload a first-class experience — per-file sensitive toggles, clear provider errors, actionable recovery dialogs.

> **Historical note:** Per-file embedding routing (sensitive → Ollama, non-sensitive → OpenAI) was
> originally planned but removed because it created a vector dimension mismatch (768 vs 1 536 in
> the same DB column). The product is now Ollama-only; the `sensitive` toggle in the upload UI
> is scheduled for removal in Batch 13.

### Upload UX

- [x] File list in upload dialog — all selected files stacked with name, size, individual **Sensitive** toggle
- [x] Amber shield badge on sensitive file cards
- [x] Remove files individually from the list before uploading

### Embedding (Ollama-only)

- [x] All embeddings use **Ollama** — 768-dim, `nomic-embed-text`
- [x] `lib/rag/vector.ts` — `getExpectedVectorDimension()` returns 768
- [x] Ollama connection errors → `errorCode: "OLLAMA_UNAVAILABLE"`
- [x] `app/api/check-ollama/route.ts` — pings Ollama availability (3 s timeout)
- [x] Recovery modal shows `ollama serve` command when Ollama is unreachable

### Test plan

- Upload a PDF with table-heavy content (no sentence punctuation) — confirm it embeds without context-length error
- Stop Ollama: recovery modal shows "Ollama unavailable" with `ollama serve` command
- Confirm `vector_dims(embedding)` in DB is 768

### Potential issues

**PDF / table / list text — sentence splitter and context length**

- **Symptom:** PDFs dominated by tables, bullets, or financial rows (no `. ! ?` + capital boundary) caused `input length exceeds the context length` from the embedder.
- **Root cause:** (1) Regex sentence split in `lib/rag/chunking.ts` can treat the whole file as one “sentence”. (2) Chunk length was once measured in chars; WordPiece can be ~2 chars/token on dense text.
- **Fix:** Long-segment caps + tokenizer-aware chunking (**Batch 10**). `nomic-embed-text` supports a large tokenizer `model_max_length` (8192); use `OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS` if Ollama’s true limit is lower.
- **Watch out for:** Spreadsheet exports with no prose; Finnish / morphologically rich text; re-verify limits if you change embedding model.

**pdf2json Type3 font warnings**

- **Symptom:** `Warning: Found Type3 font...` spam in dev when uploading certain PDFs.
- **Root cause:** pdf2json binds `console.log` at module load; runtime patches do not help.
- **Fix:** `PDF2JSON_DISABLE_LOGS=1` in `.env` / `.env.example`. Parse errors still surface via `pdfParser_dataError`.
- **Watch out for:** Upgrading pdf2json — confirm the env flag still exists.

**Historical — dual-provider embedding routing (pre–Ollama-only)**

- Routing sensitive vs non-sensitive files to different embedding dimensions (768 vs 1536) into one column caused dimension mismatch. **Rule:** one global embedding model and dimension; any model change requires migration + re-index.

**Ollama reachability check before upload**

- `checkOllamaReachable()` (3 s timeout) runs before RAG upload. Healthy setups are fast; misconfigured `OLLAMA_BASE_URL` can add up to 3 s per upload. *Future:* optional short TTL cache on the result.

---

## Batch 5: Chat routing based on sensitivity and org toggle ✅ (superseded)

**Goal (original):** Route chat to Ollama or OpenAI automatically based on retrieved document sensitivity.

> **Architecture note:** This batch implemented dual-provider routing logic that is now fully
> superseded by Batch 12 (Ollama-only). `resolveChatProvider()` has been simplified — chat
> always uses Ollama; if Ollama is unreachable the request returns 503 with a clear error.
> The org DB fields added here (`openAiEnabled`, `openAiTokenBudget`, etc.) are obsolete and
> scheduled for removal in Batch 13.

- [x] `lib/ai-provider.ts` — `checkOllamaReachable(timeoutMs)` server-side helper (still used)
- [x] `app/api/ai/chat/route.ts` — simplified: always Ollama, 503 if unreachable

### Potential issues

- Superseded by **Batch 12** (Ollama-only). *No separate log entries.*

---

## Batches 6, 7, 8: OpenAI token tracking and dual-provider UX ❌ Cancelled

These batches assumed an OpenAI integration that no longer exists. All work described here — token counting, monthly budget reset, budget admin UI, provider fallback banners — is cancelled.

The product is **Ollama-only**. There is no cloud provider to count tokens for, no budget to enforce, and no fallback banner to show.

### Potential issues

- *Cancelled — no log entries.*

---

## Batch 9: Email deliverability (production-ready sending)

**Goal:** Verification emails and invitations can be delivered to any recipient, not just Resend test recipients.

### Background

In development, `onboarding@resend.dev` can be used as the `RESEND_FROM_EMAIL` for basic testing (restricted to Resend-verified test recipients). For full production sending, a verified domain is required.

### Changes

- [ ] Buy / choose a domain to use for email sending (e.g. `aurai.io`, `auraai.app`, or a subdomain of an existing domain)
- [ ] Add and verify the domain in Resend dashboard → [resend.com/domains](https://resend.com/domains)
- [ ] Add DNS records to the domain registrar (Resend shows these):
  - DKIM TXT record (`resend._domainkey`)
  - SPF TXT record (`send` subdomain)
  - MX record for bounce feedback (`send` subdomain)
  - DMARC TXT (optional but recommended)
- [ ] Set `RESEND_FROM_EMAIL=no-reply@yourdomain.com` (or similar) in production env
- [ ] Remove dev-only fallback from `email/email.ts` once confirmed working in production (or keep it — it only activates when `NODE_ENV !== "production"`)
- [ ] Test: invite a user with an external email address; confirm delivery

### Test plan

- After DNS propagation (~minutes to a few hours), Resend dashboard shows domain as "Verified"
- Run `npx tsx scripts/send-test-email.ts` with the new `RESEND_FROM_EMAIL`
- Invite a member from the app; confirm the email arrives at an address outside your control

### Potential issues

- *None recorded yet.*

---

## Batch 10: Tokenizer-aware RAG chunking ✅

**Goal:** Replace conservative character caps in `lib/rag/chunking.ts` with **real token counts** per active embedding model, so chunks use the context window efficiently without risking `input length exceeds the context length` errors.

### What was done

- [x] `lib/rag/embedding-tokenizer.ts` — `loadEmbeddingTokenizer`, `countEmbeddingTokens`, `resolveMaxChunkTokens` / `resolveTargetChunkTokens` (defaults from HF `model_max_length`; optional `OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS`, `OLLAMA_EMBEDDING_CHUNK_TARGET_TOKENS`, `OLLAMA_EMBEDDING_TOKENIZER_ID`)
- [x] `lib/rag/chunking.ts` — token-based long-segment splitting (binary search on token budget) and sentence grouping; **char fallback** when `AURA_DISABLE_EMBEDDING_TOKENIZER=1` or tokenizer load fails
- [x] Dependency `@xenova/transformers`; `serverExternalPackages` in `next.config.ts`
- [x] `chunkContentWithOffsets` is **async**; callers updated (`upload/actions`, org sources index route)
- [x] Tests: char-fallback path (`AURA_DISABLE_EMBEDDING_TOKENIZER=1`; Jest does not load Transformers.js ESM — production Next server does)
- [x] `.env.example`, `README.md`, this implementation plan updated

### Test plan (manual)

- Upload PDFs that used to stress context — confirm embed succeeds; optional: compare chunk count vs old char-only behaviour
- If you change embedding model — set `OLLAMA_EMBEDDING_TOKENIZER_ID` and/or `OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS` to match Ollama’s real limit

### Potential issues

**Tokenizer-aware RAG chunking (Transformers.js)**

- **Symptom:** Fixed char caps (~1 200 / 1 500) under-used the embedding context window; risk of `input length exceeds the context length` when limits were wrong.
- **Root cause:** Chunk sizing used char heuristics instead of WordPiece token counts for `nomic-embed-text`.
- **Fix applied:** `@xenova/transformers` / `AutoTokenizer` (`Xenova/nomic-embed-text-v1` by default); `embedding-tokenizer.ts` + token-based splits in `chunking.ts`; char fallback when `AURA_DISABLE_EMBEDDING_TOKENIZER=1` or load fails.
- **Watch out for:** Set `OLLAMA_EMBEDDING_TOKENIZER_ID` if you change `OLLAMA_EMBEDDING_MODEL`; clamp with `OLLAMA_EMBEDDING_CHUNK_MAX_TOKENS` if Ollama’s true context is below the tokenizer’s `model_max_length`; HF tokenizer download on first server load (air-gapped / CI: use env disable). **Jest** does not load Transformers ESM — tests use char fallback only.

---

## Batch 11: Invite-only member onboarding (remove admin-created accounts)

**Goal:** Admins must never create another person’s account or choose their password. Every new member is added **only by email invitation**. Invited people who do not yet have an account complete **sign-up themselves**, then accept the invitation (or follow a single clear flow documented in the UI).

### Background — current behaviour (to remove)

- **`app/(admin)/admin/create-org/page.tsx` — step 3 ("Add your first user")** offers two modes: **Create user** (email + password + name) and **Invite user**. "Create user" calls `createOrgUser` → Better Auth `createUser` with a password set by the admin — poor security and UX.
- **`components/org/users.tsx`** — "Add member" dialog repeats the same **Create user / Invite user** split.

### Target behaviour

- **Step 3 of create-org** is **invite-only**: email(s), role, send invitation — same pattern as today’s "Invite user" branch. Remove the **Create user** tab, form, and related state (`addMode`, `userForm`, `existingUser` list for created users).
- **Org → Users** dialog: **invite-only** — remove the create-user form; keep invitation + dev-mode link copy behaviour.
- **Invitee without an account:** document and verify the flow end-to-end, e.g.:
  - User receives invite email → opens link → if no session, redirect to **sign-up** (or sign-in) with email prefilled if possible → after account exists, **accept invitation** (Better Auth organisation invitation flow). Adjust copy on invite email and/or acceptance page so this is obvious ("Create your password on our site — we never set it for you").
- **Server:** remove or gate `createOrgUser` in `lib/actions.ts`:
  - Preferred: **delete** `createOrgUser` and all imports once no UI calls it.
  - If something still needs programmatic user creation (e.g. tests only), isolate it to test helpers — not admin UI.

### Checklist

- [ ] `create-org/page.tsx` — step 3: invite UI only; "Skip" / "Continue" unchanged; preview card counts invited pending members, not "created" users
- [ ] `components/org/users.tsx` — remove create-user mode; single invite flow
- [ ] Remove `createOrgUser` from `lib/actions.ts` (and `signUpSchema` usage tied only to that flow, if unused elsewhere)
- [ ] Audit any other callers of `createOrgUser` or `auth.api.createUser` from admin flows
- [ ] E2E or manual test: invite → new user signs up → joins org; invite → existing user accepts
- [ ] Short copy pass: invite emails + in-app help text explain that **passwords are always chosen by the invitee**

### Test plan

- Create org wizard: complete steps 1–2 → step 3 shows only invite; no password fields
- Send invite to new email → complete sign-up → accept invite → user appears in org members
- Send invite to email that already has an account → accept from link → member added
- Org settings → Users: no "Create user" path; invite still works
- Regression: `/api/admin/invite` permissions unchanged

### When to schedule

Fit around **Batch 9** (email deliverability) — invitations are much easier to test with a verified domain. Can start UI removal earlier; full E2E validation is smoother once production-like email works.

### Potential issues

- *None recorded yet.*

---

## Batch 12: Ollama-only deployment (remove OpenAI)

**Goal:** Run the entire product on **Ollama only** — no OpenAI API keys, no dual-provider routing, no `gpt-4o-mini` / `text-embedding-3-small` code paths. **Embeddings stay 768-dim** (`nomic-embed-text` or your chosen Ollama embedding model).

### Why this is a distinct batch

Removing OpenAI touches **config, provider factory, chat routing, RAG errors, org DB fields, `web_search`, optional dependencies, and docs**. Doing it in one pass avoids half-migrated code.

### Prerequisites (data)

- **DB column** must already be **`vector(768)`** (see existing migration for Ollama). If you still have `vector(1536)` from an OpenAI era, run the dimension migration + **re-index all documents** before or as part of this batch.
- **No mixed vectors** in `embeddings` — old OpenAI rows must be cleared or re-embedded.

### Configuration

- [ ] **`.env` / `.env.example`:** set `AI_PROVIDER=ollama` as the documented default; remove or clearly mark `OPENAI_API_KEY` as unused (or delete).
- [ ] Document `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL` as **required** for production.

### Core AI layer (`lib/ai-provider.ts`)

- [ ] Default `getActiveProvider()` to **`ollama`** (unknown env values → `ollama`, not `openai`).
- [ ] Remove `openai` imports and `getChatModel` / `getEmbeddingModel` branches for OpenAI — **or** keep a thin `AiProvider` type with only `"ollama"` if you want TypeScript to enforce single-provider.
- [ ] Delete `OPENAI_API_KEY` checks if any.

### Chat (`app/api/ai/chat/route.ts`)

- [ ] **Simplify `resolveChatProvider()`:** if the product is Ollama-only, routing is always: use Ollama for chat; if Ollama is down, **return 503** (or a clear error) — **no fallback to OpenAI**.
- [ ] Remove org-driven reasons that existed only for OpenAI (`openAiEnabled`, token budget forcing Ollama, etc.) **or** hide those DB fields until you need another cloud provider later.
- [ ] Remove **`web_search`** tool injection (`@ai-sdk/openai` `webSearch`) — it has no Ollama equivalent in this stack. If you need live web later, add a **separate** tool (e.g. Tavily, Exa) in a dedicated batch.
- [ ] Stream metadata `provider` can stay as `"ollama"` only, or simplify UI.

### RAG

- [ ] **`lib/rag/vector.ts`:** drop OpenAI dimension branch; `getExpectedVectorDimension()` returns **768** only (or reads from env model metadata later).
- [ ] **`lib/rag/upload/actions.ts`:** remove `QUOTA_EXCEEDED` / OpenAI-specific messages; keep **`OLLAMA_UNAVAILABLE`** and connection errors.
- [ ] **`components/org/org-files-list.tsx`:** recovery modal — remove "OpenAI quota exhausted" and "Add OpenAI credits" paths; keep only **Ollama unreachable / misconfigured** guidance.
- [ ] **`lib/rag/search.ts`:** dimension check log messages — default to `ollama`, not `openai`.

### Other API routes & scripts using OpenAI

- [ ] **`lib/actions.ts`** — `generateTitleFromUserMessage` (or similar) uses `openai("gpt-4o-mini")` → switch to **`getChatModel("ollama")`** or a small dedicated Ollama call.
- [ ] **`app/api/ai/verify-source/route.ts`**, **`app/api/ai/local/route.ts`** — replace `openai(...)` with Ollama.
- [ ] **`scripts/ingest.ts`** — use Ollama embedding model only.

### Database (optional cleanup)

- [ ] **Prisma `Organization`:** fields like `openAiEnabled`, `allowSensitiveWithOpenAi`, `openAiTokenBudget`, `openAiTokensUsed`, `openAiTokensResetAt` become obsolete. Either **leave columns** (no UI) for a future provider, or add a migration to **drop** them and remove related API/UI.

### UI & docs

- [ ] **`components/ai/(chat)/message.tsx`** — provider badge: show **"Ollama"** only or remove if redundant.
- [ ] **`README.md`**, **this implementation plan** — dual-provider sections already updated to Ollama-only.

### Dependencies

- [ ] Remove **`@ai-sdk/openai`** (and **`openai`** npm package if nothing else imports it) after all imports are gone.
- [ ] Audit **`@langchain/openai`** — remove from `package.json` if unused.

### Test plan

- [ ] Chat, RAG upload, and title generation work with **`OPENAI_API_KEY` unset** and `AI_PROVIDER=ollama`.
- [ ] Stop Ollama: chat and upload fail with **clear errors**, no silent OpenAI fallback.
- [ ] No remaining `from "@ai-sdk/openai"` or `openai(` in app or `lib` (except maybe archived scripts).

### Relation to other batches

- **Batch 10 (tokenizer chunking):** Ollama-only (no OpenAI branch needed).
- **Batches 6–8:** cancelled — assumed OpenAI billing which no longer exists.

### Potential issues

- **Query vs stored embedding dimension:** If indexed documents used one dimension and `OLLAMA_EMBEDDING_MODEL` now produces another, hybrid search can fail or return empty context — see **Notes → Cross-cutting potential issues**. The dimension check in `lib/rag/search.ts` logs a warning on first search.

---

## Batch summary

| Batch | What it delivers | Status |
|-------|-----------------|--------|
| 1 | Ollama working end-to-end | ✅ Done |
| 2 | Sensitive flag on documents | ✅ Done (superseded — removal in Batch 13) |
| 3 | UI — scrollable layouts, unified CSS, org colours | ✅ Done |
| 4 | Upload UX, Ollama error surfacing | ✅ Done |
| 5 | Chat routing (dual-provider) | ✅ Done (superseded by Batch 12) |
| 6 | OpenAI token counting and budget | ❌ Cancelled |
| 7 | Admin UI for OpenAI budget and toggle | ❌ Cancelled |
| 8 | User-facing OpenAI token visibility | ❌ Cancelled |
| 9 | Email deliverability (verified domain) | ⬜ Not started |
| 10 | Tokenizer-aware RAG chunking (Ollama-only) | ✅ Done |
| 11 | Invite-only onboarding (remove admin-created users + passwords) | ⬜ Not started |
| 12 | Ollama-only deployment (remove OpenAI) | ✅ Done |
| 13 | Schema + UI cleanup (remove sensitive flag, obsolete org AI fields) | ✅ Done |
| 14 | Documentation-only assistant (remove tone / custom prompt; strict system prompt) | ✅ Done |
| 15 | Smaller default Ollama chat model (env-driven) | ⬜ **Recommended next** |

---

## Batch 15: Smaller default Ollama chat model (env-driven)

**Goal:** Cut **time-to-first-token** and total generation time for chat by standardizing on a **lighter** Ollama **chat** model, while keeping **embeddings** unchanged (`nomic-embed-text`, 768-dim). Switching models stays a **configuration change** (`OLLAMA_CHAT_MODEL`) — no per-org UI required.

### Why this batch

- Chat quality for this product is **documentation-grounded** (cite chunks, no general-knowledge filler). Smaller instruct models (roughly **1B–8B** class, quantized) are often **fast enough** and may follow structured instructions well; very large models add latency without proportional benefit for short RAG answers.
- The app already reads **`OLLAMA_CHAT_MODEL`** in `lib/ai-provider.ts`; the work here is mainly **defaults**, **documentation**, and **validation** so teams don’t run a heavier model than they need.

### Recommended default (starting point)

Pick **one** of these families (exact tag = `ollama pull` name on your machine):

| Tier | Example tags (illustrative) | Notes |
|------|-----------------------------|--------|
| Fastest / smallest | `llama3.2:1b`, `phi3:mini`, `gemma2:2b` | Lowest latency; may be weaker on nuance or long answers. |
| Balanced | `llama3.2:3b`, `mistral:7b-instruct` (quantized) | Common sweet spot for speed vs quality on modest hardware. |

**Do not change** `OLLAMA_EMBEDDING_MODEL` in this batch unless you explicitly plan a separate migration (vector dimension + re-index).

### Checklist

- [ ] **Choose** a default chat tag (e.g. `llama3.2:3b`) after a quick smoke test on your target hardware (laptop vs server GPU).
- [ ] Update **`.env.example`**: set `OLLAMA_CHAT_MODEL` to that default; add 2–4 lines on **tradeoffs** (speed vs quality) and how to switch back (e.g. `llama3.1` or `llama3.1:8b`).
- [ ] Optionally update **`README.md`** (stack / configuration) to mention the default and that chat is separate from embeddings.
- [ ] **Operational:** document `ollama pull <model>` for deploys so the model exists before traffic hits the app.
- [ ] **Validate:** same RAG flows (upload → chat with citations; `retrieve_context` follow-up); confirm time-to-first-token improves vs your previous default.
- [ ] If anything regresses (citations dropped, ignores system prompt), add an entry under **Batch 15 → Potential issues** below and bump to a slightly larger tag or tune generation params in a follow-up (not required in this batch).

### Test plan

- Local: set `OLLAMA_CHAT_MODEL` to the new default, restart dev server, run a few **short** and **medium** doc-grounded questions; compare latency to previous model.
- Confirm **`rag.*` / `chat.*` logs** still show the expected model name (`getOllamaModelsForLog()` / ops events).
- **Embedding** path unchanged: upload still produces 768-dim vectors; hybrid search unchanged.

### Relation to other batches

- **Batch 9 / 11:** Independent (email / invites).
- **Batch 10:** Embedding tokenizer chunking — independent; chat model size does not change embedding model.

### Potential issues

- *After you change the default chat model, add latency/quality notes here if regressions appear.*

---

## Batch 14: Documentation-only assistant (remove org AI tone & custom system prompt)

**Goal:** Remove per-organization controls for “how the AI behaves” (tone presets and free-text system prompt). Fix assistant behaviour in code: answers must **only** reflect retrieved organization documents, with citations — **no** general-knowledge filler, **no** fact-checking documents against external truth, **no** creative elaboration beyond what sources support.

### What was done

- [x] `lib/utils.ts` — `getSystemPrompt()` rewritten; `getUserContextMsg()` no longer asks the model to “align with org values” as factual guidance
- [x] `components/org/ai.tsx` — tone pills and system-prompt textarea removed; page explains knowledge-base-only behaviour
- [x] `lib/actions.ts` — removed `handleUpdateOrganizationTone`, `handleUpdateOrganizationSystemPrompt`; `createOrganization` no longer passes `tone`
- [x] `lib/schema.ts`, `lib/auth.ts`, `lib/types.ts` — dropped `tone` / `systemPrompt` from org shape
- [x] Prisma migration — drop `organization.tone` and `organization.systemPrompt`
- [x] `app/api/ai/chat/route.ts` — `retrieve_context` tool description clarified (KB-only)
- [x] `lib/utils.test.ts` — expectations updated

### Test plan

- Org settings → former AI page shows knowledge base uploads only; no tone or custom prompt UI
- Chat: answers cite chunks; for questions with no retrieval, model states KB has no information (does not invent from general knowledge)
- `npx prisma migrate deploy` (or `db push` in dev) applies migration

### Potential issues

**Documentation-only assistant**

- **Goal:** Chat acts as a **reader of org documents**, not general chat — no tone/custom prompt; no general-knowledge filler; no “fact-checking” docs against the outside world.
- **Fix applied:** Dropped `organization.tone` and `organization.systemPrompt`; `getSystemPrompt()` / `getUserContextMsg()` encode cite-only behaviour.
- **Watch out for:** Small LLMs may still drift from instructions; users may expect helpful general answers — align product copy.

---

## Batch 13: Schema and UI cleanup (sensitive flag + obsolete org AI fields)

**Goal:** Remove the `sensitive` document flag and the OpenAI-related org DB fields — both were built for a dual-provider world that no longer exists.

### Why remove the sensitive flag

Since every document is processed entirely on-premise by Ollama, every file is inherently private. The "sensitive" distinction was meaningful only when OpenAI was a possible destination. With Ollama-only, the flag adds UI noise without providing any protection guarantee beyond what the architecture already guarantees universally.

### DB schema

- [ ] Migration: drop `sensitive` column from `resources` table
- [ ] Migration: drop `openAiEnabled`, `allowSensitiveWithOpenAi`, `openAiTokenBudget`, `openAiTokensUsed`, `openAiTokensResetAt` from `Organization` table
- [ ] Update `prisma/schema.prisma` to match

### Upload UI

- [ ] `components/org/org-files-list.tsx` — remove per-file Sensitive toggle and amber shield badge
- [ ] Remove `sensitive` from `FormData` in the upload flow

### RAG layer

- [ ] `lib/rag/upload/actions.ts` — remove `sensitive` parameter from `processRagFile`
- [ ] `lib/rag/search.ts` — remove `r."sensitive"` from `vectorSearch` / `keywordSearch` and `SearchRow` type

### Chat route

- [ ] `app/api/ai/chat/route.ts` — remove any remaining reference to `hasSensitiveDocs` or `sensitive` field in chunk results

### Test plan

- Upload a file — no Sensitive toggle visible in the dialog
- Prisma Studio — `resources` table has no `sensitive` column; `Organization` has no `openAi*` fields
- Chat works normally — no errors from missing `sensitive` field in search results

### Potential issues

**Removed columns / fields**

- `resources.sensitive`, org `openAi*` fields, unused provider plumbing — see migration folder `20260403000000_remove_sensitive_and_openai_fields` (and follow-ups such as `20260403193115_removing_the_sensitive_field` if present).
- **Watch out for:** Forks or old code paths that still reference removed columns will fail at runtime or migrate.

---

## Notes

### Cross-cutting potential issues

These apply across batches — not tied to a single delivery milestone.

**Switching the Ollama embedding model**

- Changing `OLLAMA_EMBEDDING_MODEL` to a different **vector dimension** without migrating the DB column and **re-indexing all documents** causes new uploads to work while old rows become invisible to search or error at query time. Procedure: migration for `vector(N)` → full re-index → update env → restart.

**Vector search query dimension must match stored embeddings**

- `hybridSearch()` embeds the user query with the current model. If stored rows used another dimension, pgvector errors or the route may continue with **zero** retrieved context. Check `vector_dims(embedding)` in SQL vs expected 768; watch logs for the dimension check on first search.

**All orgs share one deployment embedding model**

- `OLLAMA_EMBEDDING_MODEL` is global. Per-org embedding models would need schema and query changes (e.g. filter by model id).

**Prisma migration drift after manual SQL**

- Raw `ALTER TABLE` without a migration file causes shadow DB / `migrate` failures (`P3006`). Prefer proper migrations; run `npx prisma migrate status` after any manual change.

### Architecture (Ollama-only)

| Concern | Rule |
|--------|------|
| Embedding (indexing) | Ollama `nomic-embed-text`, **768-dim** |
| Chat | Ollama; 503 if unreachable |
| Vector column | **Same dimension for every row** — never mix models without migration + re-index |

**Invariant:** Changing the embedding model without updating the `vector(N)` column and re-indexing all documents can make vector search return **no rows** with no obvious UI error. The hybrid-search dimension check logs a warning on first query when misconfigured.

- **Single provider:** All AI work (chat, embeddings) uses **Ollama**. No OpenAI keys required.
- **Vector dimension: 768** — all embeddings use `nomic-embed-text` (768-dim). The DB column is `vector(768)`. Do not change the embedding model without running a dimension migration and re-indexing all documents.
- **Ollama must be running** — if Ollama is unreachable, chat and file uploads return clear 503 errors. There is no cloud fallback.
- **No `web_search` tool** — removed in Batch 12. If live web context is needed in future, add a dedicated tool (e.g. Tavily, Exa) in its own batch.
- **No sensitive flag** — removed in Batch 13. The column no longer exists in the schema or the UI.

### Development

- **Dev org creation**: set `DEV_ALLOW_SELF_ORG_CREATION=1` in `.env` — any signed-in user can create an org. Never set in production.
- **Dev invite emails**: invite links are logged in the server console when Resend can't deliver (unverified domain). Use the logged link to test the full flow.
- **Dev invite auth**: the `DEV_ALLOW_SELF_ORG_CREATION` bypass extends to `/api/admin/invite` — non-admin org owners can invite into their own org only.
- **Migrations**: never run `ALTER TABLE` manually without creating a proper migration file. After any manual SQL, run `npx prisma migrate status` to check for drift.
