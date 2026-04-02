# AuraAI — Implementation Plan

This document is the single source of truth for planned development batches.
Each batch is independently testable before moving to the next.
Check the box when a batch is fully done.

### Standing rule — update [`potential-issues.md`](potential-issues.md) after every batch

Before marking a batch ✅ Done, ask:
> *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*

If yes — or even if it was a close call — add an entry to [`potential-issues.md`](potential-issues.md).
Keep entries short: symptom, root cause, fix applied, and what to watch out for next time.

---

## Overview

- Switch all embeddings to Ollama (one model, one vector table).
- Add a `sensitive` flag to documents.
- Route chat to Ollama or OpenAI based on: sensitivity of retrieved docs, org-level toggle, and token budget.
- Track OpenAI token usage per org with a monthly cap.
- Show remaining tokens to users and admins.
- Allow admins to toggle OpenAI off entirely per org.
- Email deliverability: verify a sending domain so invites + verification emails can reach any recipient.

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

---

## Batch 2: Document sensitivity flag ✅

**Goal:** Mark documents as sensitive at upload time. Surface that flag in search results.

- [x] DB migration — add `sensitive boolean NOT NULL DEFAULT false` to `resources` table
- [x] Upload UI — "Sensitive document" toggle in `components/org/org-files-list.tsx`
- [x] `lib/rag/upload/actions.ts` — accept and store `sensitive` in `processRagFile`
- [x] `lib/rag/search.ts` — add `r."sensitive"` to both `vectorSearch` and `keywordSearch`; update `SearchRow` type
- [x] UX copy — toggle shows: "This file contains confidential data. It will be processed only by the on-premise AI model — never sent to the cloud."

### Test plan

- Upload a document with "Sensitive" toggled on
- Check Prisma Studio: `resources.sensitive = true`
- Trigger a chat query that retrieves the sensitive doc; confirm `sensitive: true` is present in results

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

---

## Batch 4: Upload UX and provider error surfacing ✅

**Goal:** Make document upload a first-class experience — per-file sensitive toggles, clear provider errors, actionable recovery dialogs.

> **Design note:** Per-file embedding routing (sensitive → Ollama, non-sensitive → OpenAI) was
> originally planned but removed because it created a vector dimension mismatch (768 vs 1 536 in
> the same DB column). Embeddings always use the global `AI_PROVIDER`. The `sensitive` flag
> controls chat routing only. See `potential-issues.md` for full context.

### Upload UX

- [x] File list in upload dialog — all selected files stacked with name, size, individual **Sensitive** toggle
- [x] Amber shield badge on sensitive file cards
- [x] Remove files individually from the list before uploading

### Embedding routing (as built)

- [x] `sensitive` flag stored per file and passed through `FormData`
- [x] All embeddings use **global `AI_PROVIDER`** — no per-file provider override
- [x] `lib/rag/vector.ts` — `getExpectedVectorDimension()` reads `AI_PROVIDER` dynamically (no more hardcoded 1 536)
- [x] Ollama connection errors → `errorCode: "OLLAMA_UNAVAILABLE"`
- [x] OpenAI quota errors → `errorCode: "QUOTA_EXCEEDED"`
- [x] `app/api/check-ollama/route.ts` — pings Ollama availability (3 s timeout)
- [x] Log: `[embed] Using <provider> for file: <filename>`

### Provider error recovery dialog

- [x] `ProcessRagFileResult` extended with `errorCode?`
- [x] Recovery modal shown for `QUOTA_EXCEEDED` and `OLLAMA_UNAVAILABLE`
- [x] Generic errors continue as toasts

> ⚠️ **Known bug (fix tracked in Batch 6):** The recovery modal's "Switch to Ollama" and "Use
> OpenAI anyway" buttons are no-ops. They send `forceProvider` in FormData which the backend
> now ignores. The modal needs to be redesigned to show config-level instructions instead of
> attempting a per-request provider switch.

### Test plan

- Upload 3 files, mark 2 as sensitive — confirm amber badge appears on the correct cards
- Confirm `resources.sensitive = true/false` in Prisma Studio after upload
- Server log shows `[embed] Using ollama` (or `openai`) matching `AI_PROVIDER`
- Upload a PDF with table-heavy content (no sentence punctuation) — confirm it embeds without context-length error
- Trigger quota exceeded (bad OpenAI key): recovery modal appears
- Stop Ollama (`AI_PROVIDER=ollama`): recovery modal shows "Ollama unavailable"
- Confirm `vector_dims(embedding)` in DB matches expected dimension for active provider

---

## Batch 5: Chat routing based on sensitivity and org toggle ✅

**Goal:** Route chat to Ollama or OpenAI automatically based on retrieved document sensitivity.

- [x] `prisma/schema.prisma` + migration — added to `Organization`:
  - `openAiEnabled Boolean @default(true)`
  - `allowSensitiveWithOpenAi Boolean @default(false)` ← Option A locked in
  - `openAiTokenBudget Int?`
  - `openAiTokensUsed Int @default(0)`
  - `openAiTokensResetAt DateTime?`
- [x] `lib/ai-provider.ts` — `checkOllamaReachable(timeoutMs)` server-side helper
- [x] `app/api/ai/chat/route.ts` — `resolveChatProvider()` function with full routing logic:
  - any sensitive chunks → Ollama **if Ollama is reachable**
  - any sensitive chunks + Ollama not reachable + `allowSensitiveWithOpenAi = false` → **blocked** (HTTP 503) with clear message
  - any sensitive chunks + Ollama not reachable + `allowSensitiveWithOpenAi = true` → OpenAI with warning logged
  - `openAiEnabled = false` → Ollama (falls back to OpenAI if Ollama down, logged)
  - `openAiTokensUsed >= openAiTokenBudget` → Ollama (falls back if Ollama down, logged)
  - otherwise → active provider (OpenAI default)
- [x] Log: `[chat] Routing to: <provider> (reason: <reason>)`
- [x] Log: `[chat] Blocked: sensitive context requires Ollama (Ollama not reachable)`

### Test plan

- Upload one sensitive + one non-sensitive doc; query each
  - Logs must show `[chat] Routing to: ollama (reason: sensitive document in context)` for the sensitive one
  - Logs must show `[chat] Routing to: openai (reason: standard)` for the non-sensitive one
- Set `openAiEnabled = false` in DB → all chats must route to Ollama regardless of sensitivity
- Set `openAiTokenBudget = 1` and send a chat → next request logs `reason: monthly token budget exhausted`
- Sensitive doc + Ollama stopped:
  - `allowSensitiveWithOpenAi = false` (default) → HTTP 503, clear blocked message to user
  - `allowSensitiveWithOpenAi = true` → falls back to OpenAI, warning logged server-side
- Non-sensitive doc + Ollama stopped + `openAiEnabled = false`:
  - Falls back to OpenAI, warning logged (not blocked — sensitive data not involved)
- Confirm `web_search` tool is absent in Ollama responses (check network tab — tool call should not appear)

---

## Batch 6: Token tracking, budget enforcement, and dual-provider UX polish

**Goal:** Count OpenAI tokens, enforce monthly budget, fix the broken recovery modal, and surface provider fallbacks to users.

### Token tracking

- [ ] `onFinish` in chat route: read `usage.totalTokens`, update `openAiTokensUsed` on org via Prisma
- [ ] Monthly reset logic: if `openAiTokensResetAt` is null or in the past → reset `openAiTokensUsed = 0`, set `openAiTokensResetAt` to start of next calendar month
- [ ] Admin API: `PATCH /api/admin/org/[slug]/ai-settings` — allow setting `openAiTokenBudget`, `openAiEnabled`, `allowSensitiveWithOpenAi`

### Recovery modal redesign (fixes Batch 4 known bug)

The current modal sends `forceProvider` which the backend ignores. Replace with config-level guidance:

- [ ] **QUOTA_EXCEEDED modal:**
  - Remove "Switch to Ollama" button (can't be done per-request)
  - Show: "Add OpenAI credits" → link to billing page
  - Show: "Use Ollama instead" → instructions: set `AI_PROVIDER=ollama` in `.env`, run dimension migration, restart server, re-upload documents
- [ ] **OLLAMA_UNAVAILABLE modal:**
  - Remove "Use OpenAI anyway" button (can't be done per-request)
  - Show: "Start Ollama" → display `ollama serve` command
  - Show: "Switch to OpenAI" → same config-level instructions as above (reverse)

### Provider fallback visibility in chat UI

- [ ] When `resolveChatProvider()` falls back from Ollama → OpenAI, include a flag in the stream response metadata
- [ ] Chat UI: show a subtle amber warning banner when a fallback occurred:
  `"Ollama was unavailable — this response was generated by OpenAI"`
- [ ] When chat is blocked (503): display the error message inline in the chat instead of a generic failure

### Startup dimension integrity check

- [ ] On server start (or first request), query `SELECT vector_dims(embedding) FROM embeddings LIMIT 1`
  and compare against `getExpectedVectorDimension()` — log a prominent warning if they don't match
- [ ] This catches the case where `AI_PROVIDER` was changed without running the dimension migration

### Test plan

- Set `openAiTokenBudget = 100` on a test org; send 3 chats → `openAiTokensUsed` increments in Prisma Studio
- Exceed budget → routing log shows `reason: monthly token budget exhausted`; next month starts → counter resets automatically
- Trigger QUOTA_EXCEEDED: confirm modal shows billing link + config instructions, not the broken "Switch to Ollama" button
- Stop Ollama; trigger OLLAMA_UNAVAILABLE: confirm modal shows `ollama serve` command
- Set `AI_PROVIDER=openai` but leave DB column as `vector(768)`: confirm startup warning appears in logs
- With Ollama fallback: confirm amber warning banner appears in the chat UI
- With blocked request (sensitive + no Ollama): confirm inline error message in chat, not a blank failure

---

## Batch 7: Admin UI for budget and toggle

**Goal:** Admin can set/view token budget and toggle OpenAI per org from the UI.

- [ ] Admin org settings page — add "AI Provider" section:
  - Toggle: "Allow OpenAI for this organization" (`openAiEnabled`)
  - Toggle: "Allow sensitive documents to use OpenAI as fallback" (`allowSensitiveWithOpenAi`)
  - Input: "Monthly OpenAI token budget (tokens)" — leave blank for unlimited
  - Read-only: "Tokens used this month: X / Y — resets [date]"
- [ ] Wire to `PATCH /api/admin/org/[slug]/ai-settings` (built in Batch 6)
- [ ] `app/api/org/route.ts` — include `openAiEnabled`, `openAiTokensUsed`, `openAiTokenBudget`, `openAiTokensResetAt` in org response

### Test plan

- Toggle OpenAI off → save → send chat → server logs `reason: OpenAI disabled for this org`
- Re-enable OpenAI → send chat → routes to OpenAI again
- Set budget to 1 000 → send chat → Prisma Studio shows `openAiTokensUsed` rising
- Set `allowSensitiveWithOpenAi = true` → stop Ollama → send chat with sensitive doc → fallback banner visible in chat

---

## Batch 8: User-facing token and provider visibility

**Goal:** Users understand which AI provider is active and how much OpenAI budget remains.

- [ ] New API: `GET /api/org/token-usage?slug=<slug>` → `{ openAiEnabled, tokensUsed, tokenBudget, resetsAt, activeProvider }`
- [ ] `components/org/ai-settings-dialog.tsx` (or equivalent) — show:
  - Active embedding provider (from `AI_PROVIDER` env, surfaced via API)
  - Active chat provider (OpenAI / Ollama / blocked)
  - Token usage bar: "X / Y tokens used — resets [date]" (hidden if no budget set)
  - Badge: "Sensitive documents: on-premise only" when any sensitive docs exist for the org
- [ ] If `openAiEnabled = false`: show clear indicator "OpenAI disabled for this org"

### Test plan

- Open AI settings dialog with OpenAI active + budget set — usage bar shows correct numbers
- Exhaust budget → indicator updates on next page load
- `openAiEnabled = false` → "OpenAI disabled" badge visible
- Sensitive docs uploaded → "on-premise only" badge visible

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

---

## Batch 10: Tokenizer-aware RAG chunking (deferred)

**Goal:** Replace conservative character caps in `lib/rag/chunking.ts` with **real token counts** per active embedding model, so chunks use the context window efficiently without risking `input length exceeds the context length` errors.

### Why not now

Character limits are simple, dependency-light, and already safe for worst-case token density. Tokenizer integration adds dependencies, must stay aligned with `AI_PROVIDER` and embedding model versions, and needs regression tests — defer until the dual-provider and upload flows feel stable.

### When to schedule (recommended)

| Situation | Priority |
|-----------|----------|
| You are about to **switch embedding model** (new context length or tokenizer) | **High** — swap tokenizer + re-tune max tokens in one batch |
| You want **larger chunks for OpenAI** (better retrieval) while keeping Ollama safe | **Medium** — token caps differ by provider |
| Production shows **rare OOM / context errors** despite current caps | **High** — indicates edge cases char heuristics miss |
| Core product batches (6–9) are still open and char caps work | **Low** — wait |

**Pragmatic rule of thumb:** implement after **Batch 6** (token budget + dual-provider polish is in place) *unless* you change the embedding model earlier — then do tokenizer work in the **same** batch as the model switch.

### Implementation sketch (for later)

- [ ] Introduce a small `countEmbeddingTokens(text, provider)` (or per-model) helper — **OpenAI:** `tiktoken` or `@ai-sdk` token helpers for `text-embedding-3-small`; **Ollama:** tokenizer matching `OLLAMA_EMBEDDING_MODEL` (e.g. Hugging Face tokenizer for `nomic-embed-text`, or official path documented by Ollama).
- [ ] Refactor chunk assembly: grow/shrink segments until token count ≤ **model max context minus safety margin** (e.g. 1 900 for a 2 048 BERT limit), not fixed char counts.
- [ ] Keep `splitLongSegment`-style word-boundary splitting as a **fallback** when tokenization is unavailable (tests, CI without native deps).
- [ ] Golden tests: Finnish compound text, dense tables, English prose — assert no chunk exceeds the limit and offsets remain correct.
- [ ] Document in `potential-issues.md`: which tokenizer package maps to which `AI_PROVIDER` / env model name.

### Test plan

- Same PDFs that previously triggered Ollama context errors — upload succeeds; spot-check chunk sizes in logs or a debug endpoint
- `AI_PROVIDER=openai` — verify chunks approach but never exceed the OpenAI model limit
- Switch `OLLAMA_EMBEDDING_MODEL` in env — confirm token limit follows the new model (or explicit error if tokenizer not bundled)

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
- [ ] **`README.md`**, **`potential-issues.md`** — rewrite dual-provider sections as **Ollama-only** (or "historical note").
- [ ] **Batch 6–8** items that assume OpenAI billing/tokens — **cancel or narrow** to match Ollama-only (no OpenAI token budget UI).

### Dependencies

- [ ] Remove **`@ai-sdk/openai`** (and **`openai`** npm package if nothing else imports it) after all imports are gone.
- [ ] Audit **`@langchain/openai`** — remove from `package.json` if unused.

### Test plan

- [ ] Chat, RAG upload, and title generation work with **`OPENAI_API_KEY` unset** and `AI_PROVIDER=ollama`.
- [ ] Stop Ollama: chat and upload fail with **clear errors**, no silent OpenAI fallback.
- [ ] No remaining `from "@ai-sdk/openai"` or `openai(` in app or `lib` (except maybe archived scripts).

### Relation to other batches

- **Batch 10 (tokenizer chunking):** becomes **Ollama-only** (no OpenAI branch in the tokenizer design).
- **Batches 6–8** as written assume OpenAI billing — **re-scope** them to "Ollama-only" or skip.

---

## Batch summary

| Batch | What it delivers | Status |
|-------|-----------------|--------|
| 1 | Ollama working end-to-end | ✅ Done |
| 2 | Sensitive flag on documents | ✅ Done |
| 3 | UI — scrollable layouts, unified CSS, org colours | ✅ Done |
| 4 | Upload UX, provider error surfacing (⚠️ recovery modal fix pending) | ✅ Done |
| 5 | Auto-routing chat to correct provider | ✅ Done |
| 6 | Token counting, budget reset, recovery modal fix, fallback UX | ⬜ Not started |
| 7 | Admin UI for budget and toggle | ⬜ Not started |
| 8 | User-facing token and provider visibility | ⬜ Not started |
| 9 | Email deliverability (verified domain) | ⬜ Not started |
| 10 | Tokenizer-aware RAG chunking (per embedding model) | ⬜ Deferred |
| 11 | Invite-only onboarding (remove admin-created users + passwords) | ⬜ Not started |
| 12 | Ollama-only deployment (remove OpenAI) | ⬜ Not started |

---

## Notes

### Dual-provider rules (read before changing anything AI-related)

- **Ollama-only roadmap:** If you are **dropping OpenAI entirely**, follow **Batch 12** — the bullets below describe the current dual-provider codebase until that batch is done.
- **One `AI_PROVIDER`, one vector dimension**: `AI_PROVIDER=ollama` → all vectors must be 768-dim. `AI_PROVIDER=openai` → all vectors must be 1 536-dim. Mixing is not supported — it causes a pgvector dimension mismatch error. Switching providers requires a DB migration + full re-index.
- **`sensitive` flag controls chat routing only**, not embedding routing. All files are embedded by the global `AI_PROVIDER`.
- **`web_search` tool** is OpenAI-only — automatically excluded when routing to Ollama.
- **Ollama must be running** in any environment where `AI_PROVIDER=ollama` — for both chat and embedding.
- **Token budget** (`openAiTokenBudget`) defaults to NULL (unlimited). Set it only after Batch 6 reset logic is deployed, or the budget will never reset.
- **Recovery modal "Switch to Ollama"** is currently a no-op (Batch 4 known bug). Fix tracked in Batch 6.
- **Chat fallback to OpenAI** (when Ollama is down + `allowSensitiveWithOpenAi = true`) is silent to the user until Batch 6 adds the warning banner.

### Development

- **Dev org creation**: set `DEV_ALLOW_SELF_ORG_CREATION=1` in `.env` — any signed-in user can create an org. Never set in production.
- **Dev invite emails**: invite links are logged in the server console when Resend can't deliver (unverified domain). Use the logged link to test the full flow.
- **Dev invite auth**: the `DEV_ALLOW_SELF_ORG_CREATION` bypass extends to `/api/admin/invite` — non-admin org owners can invite into their own org only.
- **Migrations**: never run `ALTER TABLE` manually without creating a proper migration file. After any manual SQL, run `npx prisma migrate status` to check for drift.
