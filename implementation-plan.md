# AuraAI — Implementation Plan

This document is the single source of truth for planned development batches.
Each batch is independently testable before moving to the next.
Check the box when a batch is fully done.

### Standing rule — update `docs/potential-issues.md` after every batch

Before marking a batch ✅ Done, ask:
> *"Did anything break, behave unexpectedly, or only work because of a fragile assumption?"*

If yes — or even if it was a close call — add an entry to [`docs/potential-issues.md`](docs/potential-issues.md).
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

## Batch 4: Upload UX, per-file sensitivity routing, and quota recovery ✅

**Goal:** Make document upload a first-class experience. Each file gets its own sensitive toggle. Sensitive files are embedded using Ollama — never OpenAI. When the embedding provider fails (quota, unavailable), the user gets a clear actionable dialog instead of a dead-end error.

### Upload UX

- [x] File list in upload dialog — show all selected files stacked with name, size, type, and an individual **Sensitive** toggle per file (replacing the current single global toggle)
- [x] Visual state per file: normal file shows a neutral card; sensitive file shows an amber shield badge on the card
- [x] Remove files individually from the list before uploading

### Per-file embedding routing

- [x] Pass `sensitive` flag per file through `FormData` to `processRagFile`
- [x] `lib/rag/upload/actions.ts` — if `sensitive = true`, call `getEmbeddingModel("ollama")` explicitly; if `sensitive = false`, use the active provider (OpenAI or Ollama depending on `AI_PROVIDER`); `forceProvider` param overrides both
- [x] `lib/rag/embeddings.ts` — `generateEmbeddings` accepts optional `provider` parameter
- [x] Ollama connection errors detected and surfaced as `OLLAMA_UNAVAILABLE` error code
- [x] `app/api/check-ollama/route.ts` — pings Ollama availability (3 s timeout); recovery modal uses this
- [x] Log: `[embed] Using <provider> for file: <filename> (sensitive)`

### Quota and provider error recovery dialog

- [x] `ProcessRagFileResult` extended with `errorCode?: "QUOTA_EXCEEDED" | "OLLAMA_UNAVAILABLE"`
- [x] **OpenAI quota exceeded modal:** checks Ollama availability live; offers "Switch to Ollama" (if reachable) or "Add OpenAI credits" link
- [x] **Ollama unavailable modal:** offers "Use OpenAI anyway" (re-uploads with `sensitive: false`, user accepts data privacy trade-off) or "Set up Ollama" link
- [x] Generic errors continue to show as toasts

### Test plan

- Upload 3 files, mark 2 as sensitive individually — confirm correct per-file badges
- With Ollama running: sensitive files embed via Ollama (check server logs); non-sensitive via OpenAI
- With OpenAI quota exceeded: quota recovery dialog appears with Ollama option (if available)
- With Ollama down and a sensitive file: Ollama-unavailable dialog appears; choosing "use OpenAI" re-uploads successfully
- With both providers down: generic error shown

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

- Upload one sensitive + one non-sensitive doc
- Query each → logs confirm correct routing
- Set `openAiEnabled = false` in DB → all chats route to Ollama
- Sensitive + no Ollama:
  - Default: request is blocked with a clear error
  - With `allowSensitiveWithOpenAi = true`: request uses OpenAI and logs a warning

---

## Batch 6: Token tracking and budget enforcement

**Goal:** Count OpenAI tokens after each request and enforce the monthly cap.

- [ ] `onFinish` in chat route: read `usage.totalTokens`, update `openAiTokensUsed` on org
- [ ] Monthly reset logic: if `openAiTokensResetAt` is past → reset counter + set next month
- [ ] Admin API: allow setting `openAiTokenBudget` and `openAiEnabled` via PATCH

### Test plan

- Set a low token budget (e.g. 500 tokens) on a test org
- Send chats; confirm `openAiTokensUsed` increments in Prisma Studio
- Exceed budget → next request logs `Routing to: ollama (reason: budget exhausted)`

---

## Batch 7: Admin UI for budget and toggle

**Goal:** Admin can set/view token budget and toggle OpenAI per org from the UI.

- [ ] Admin org UI (`app/(admin)/admin/org/[slug]/`) — add section:
  - Toggle: "Allow OpenAI for this organization"
  - Input: "Monthly OpenAI token budget"
  - Read-only: "Tokens used this month: X / Y"
- [ ] `app/api/org/route.ts` — include token usage fields in org response

### Test plan

- Toggle OpenAI off → save → chat → logs confirm Ollama used
- Set budget to 1000 → chat → Prisma Studio shows token counter rising

---

## Batch 8: User-facing token visibility

**Goal:** Users see how much OpenAI budget remains for their org.

- [ ] New API: `GET /api/org/token-usage?slug=<slug>` → `{ openAiEnabled, tokensUsed, tokenBudget, resetsAt }`
- [ ] `components/org/ai-settings-dialog.tsx` — show usage indicator

### Test plan

- Open AI settings dialog; confirm correct remaining tokens shown
- Use up budget; refresh dialog; counter reflects new usage

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

## Batch summary

| Batch | What it delivers | Status |
|-------|-----------------|--------|
| 1 | Ollama working end-to-end | ✅ Done |
| 2 | Sensitive flag on documents | ✅ Done |
| 3 | UI — scrollable layouts, unified CSS, org colours | ✅ Done |
| 4 | Upload UX, per-file sensitivity routing, quota recovery | ✅ Done |
| 5 | Auto-routing chat to correct provider | ✅ Done |
| 6 | Token counting and monthly cap | ⬜ Not started |
| 7 | Admin UI for controls | ⬜ Not started |
| 8 | User-facing token visibility | ⬜ Not started |
| 9 | Email deliverability (verified domain) | ⬜ Not started |

---

## Notes

- **Batch 1 is a breaking change for existing embeddings**: re-index docs after migration.
- **Ollama must be running** on every environment that needs chat/embedding (local dev, staging, client on-prem).
- **`web_search` tool** is OpenAI-only — excluded from tool list when routing to Ollama.
- **Dev org creation**: set `DEV_ALLOW_SELF_ORG_CREATION=1` in local `.env` so any signed-in user can create an org without needing an admin role. Never set this in production.
- **Dev invite emails**: if Resend cannot deliver in dev (unverified domain/recipient), the invite link is logged in the server console and returned in the API response so you can test the full flow manually.
- **Dev invite auth**: the `DEV_ALLOW_SELF_ORG_CREATION` bypass is also threaded through `/api/admin/invite` — non-admin org owners can invite into their own org only (verified by `member.role = "owner"` check).
- **Quota errors**: OpenAI `insufficient_quota` (HTTP 429) surfaces as a clear user-facing message in the file upload UI rather than a generic "failed to upload".
- **Sensitive embedding gap (fixed in Batch 4)**: Batch 2 stores the `sensitive` flag but embeddings still use the global `AI_PROVIDER`. Batch 4 closes this by routing sensitive files to Ollama at embed time.
