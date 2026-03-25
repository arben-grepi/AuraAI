# AuraAI — Implementation Plan

This document is the single source of truth for planned development batches.
Each batch is independently testable before moving to the next.
Check the box when a batch is fully done.

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

## Batch 2: Document sensitivity flag

**Goal:** Mark documents as sensitive at upload time. Surface that flag in search results.

- [ ] DB migration — add `sensitive boolean NOT NULL DEFAULT false` to `resources` table
- [ ] Upload UI — "Sensitive document" toggle in `components/org/org-files-list.tsx`
- [ ] `lib/rag/upload/actions.ts` — accept and store `sensitive` in `processRagFile`
- [ ] `lib/rag/search.ts` — add `r."sensitive"` to both `vectorSearch` and `keywordSearch`; update `SearchRow` type

### Test plan

- Upload a document with "Sensitive" toggled on
- Check Prisma Studio: `resources.sensitive = true`
- Trigger a chat query that retrieves the sensitive doc; confirm `sensitive: true` is present in results

---

## Batch 3: Chat routing based on sensitivity and org toggle

**Goal:** Route chat to Ollama or OpenAI automatically based on retrieved document sensitivity.

- [ ] `prisma/schema.prisma` + migration — add to `Organization`:
  - `openAiEnabled Boolean @default(true)`
  - `openAiTokenBudget Int?`
  - `openAiTokensUsed Int @default(0)`
  - `openAiTokensResetAt DateTime?`
- [ ] `app/api/ai/chat/route.ts` — routing logic before `streamText`:
  - any sensitive chunks → Ollama
  - `openAiEnabled = false` → Ollama
  - `tokensUsed >= budget` → Ollama
  - otherwise → OpenAI
- [ ] Log routing decision: `[chat] Routing to: ollama (reason: sensitive document in context)`

### Test plan

- Upload one sensitive + one non-sensitive doc
- Query each → logs confirm correct routing
- Set `openAiEnabled = false` in DB → all chats route to Ollama

---

## Batch 4: Token tracking and budget enforcement

**Goal:** Count OpenAI tokens after each request and enforce the monthly cap.

- [ ] `onFinish` in chat route: read `usage.totalTokens`, update `openAiTokensUsed` on org
- [ ] Monthly reset logic: if `openAiTokensResetAt` is past → reset counter + set next month
- [ ] Admin API: allow setting `openAiTokenBudget` and `openAiEnabled` via PATCH

### Test plan

- Set a low token budget (e.g. 500 tokens) on a test org
- Send chats; confirm `openAiTokensUsed` increments in Prisma Studio
- Exceed budget → next request logs `Routing to: ollama (reason: budget exhausted)`

---

## Batch 5: Admin UI for budget and toggle

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

## Batch 6: User-facing token visibility

**Goal:** Users see how much OpenAI budget remains for their org.

- [ ] New API: `GET /api/org/token-usage?slug=<slug>` → `{ openAiEnabled, tokensUsed, tokenBudget, resetsAt }`
- [ ] `components/org/ai-settings-dialog.tsx` — show usage indicator

### Test plan

- Open AI settings dialog; confirm correct remaining tokens shown
- Use up budget; refresh dialog; counter reflects new usage

---

## Batch 7: Email deliverability (production-ready sending)

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
| 2 | Sensitive flag on documents | ⬜ Not started |
| 3 | Auto-routing chat to correct provider | ⬜ Not started |
| 4 | Token counting and monthly cap | ⬜ Not started |
| 5 | Admin UI for controls | ⬜ Not started |
| 6 | User-facing token visibility | ⬜ Not started |
| 7 | Email deliverability (verified domain) | ⬜ Not started |

---

## Notes

- **Batch 1 is a breaking change for existing embeddings**: re-index docs after migration.
- **Ollama must be running** on every environment that needs chat/embedding (local dev, staging, client on-prem).
- **`web_search` tool** is OpenAI-only — excluded from tool list when routing to Ollama.
- **Dev org creation**: set `DEV_ALLOW_SELF_ORG_CREATION=1` in local `.env` so any signed-in user can create an org without needing an admin role. Never set this in production.
- **Dev invite emails**: if Resend cannot deliver in dev (unverified domain/recipient), the invite link is logged in the server console and returned in the API response so you can test the full flow manually.
