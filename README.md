# AuraAI — RAG-Powered AI Chat for Organizations

A full-stack AI chat application built with Next.js 15, featuring a **Retrieval-Augmented Generation (RAG)** pipeline, multi-tenant organization management, hybrid search over document embeddings, and support for both cloud (OpenAI) and on-prem (Ollama) models.

---

## Why This Project?

This repo demonstrates production-grade AI/ML engineering: RAG pipelines, vector search, hybrid retrieval, document ingestion (files + web crawls), streaming chat, and flexible model routing. It's built as a modern SaaS-style app with auth, org scoping, and observability in mind.

---

## Technical Overview

### Architecture: RAG Pipeline

The system implements a **Retrieval-Augmented Generation** flow:

1. **Ingest** — Files and websites → text extraction → chunking → embeddings → stored in PostgreSQL (pgvector)
2. **Retrieve** — Hybrid search (vector + keyword) with RRF and reranking to surface relevant chunks
3. **Generate** — LLM receives context, chat history, and optional attachments, then streams responses with citations

### Content Ingestion

| Source       | Flow                                                                 |
|-------------|----------------------------------------------------------------------|
| **Files**   | PDF, DOCX, XLSX, TXT, MD, CSV, etc. → `extractText` → `chunkContentWithOffsets` → `generateEmbeddings` → `resources` + `embeddings` |
| **Websites**| BFS crawl (up to 50 pages) → per-page extraction → same chunking/embedding pipeline → tagged `["web-scrape", "source:<hostname>"]` |

- **Chunking**: ~2000 chars, 2-sentence overlap, sentence-aware splits; `startOffset`/`endOffset` kept for source highlighting
- **Embeddings**: OpenAI `text-embedding-3-small` (1536-dim) or Ollama `nomic-embed-text` (768-dim) — controlled by `AI_PROVIDER`

### Hybrid Search

- **Vector search**: pgvector cosine similarity (`<=>`) with configurable thresholds
- **Keyword search**: PostgreSQL full-text (`to_tsvector` + `plainto_tsquery`, `ts_rank`)
- **Fusion**: Reciprocal Rank Fusion (RRF) combines both result sets
- **Reranking**: Jaccard-based word overlap boost (70% RRF + 30% keyword overlap)

### Chat Flow

1. Validate session and org membership
2. **Pre-retrieval**: Top 8 chunks from hybrid search over last user message
3. Build system prompt + knowledge base context + user context + optional attachment context
4. Tools: `retrieve_context` (follow-up KB search) and `web_search` (OpenAI only)
5. Stream response via AI SDK; persist messages; send citation metadata for source highlighting

### Stack

| Layer      | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | Next.js 15, React 19, TypeScript, Tailwind, Radix/Shadcn |
| Auth      | Better Auth (sessions, org membership, email verification) |
| Database  | PostgreSQL, Prisma ORM, pgvector                        |
| AI        | Vercel AI SDK, OpenAI GPT-4o-mini / Ollama (configurable) |
| Storage   | AWS S3 (file uploads)                                   |
| Email     | Resend                                                  |
| Monitoring| Sentry                                                  |
| Testing   | Jest, React Testing Library, Playwright                 |

---

## Development Roadmap: Ollama + OpenAI Flexibility

The system is being extended to support **on-prem (Ollama)** alongside **cloud (OpenAI)** with intelligent routing.

### Planned Capabilities (summary)

| Batch | Goal |
|-------|------|
| **1** | Ollama provider (embeddings + chat); provider factory in `lib/ai-provider.ts`; migrate embeddings to 768-dim (Ollama nomic-embed-text) |
| **2** | Document `sensitive` flag — mark docs at upload; surface in search for routing |
| **3** | **Chat routing** — route to Ollama when any retrieved doc is sensitive, org disables OpenAI, or token budget is exhausted; otherwise use OpenAI |
| **4** | Token tracking — count OpenAI tokens per org, enforce monthly cap, reset logic |
| **5** | Admin UI — toggle OpenAI per org, set monthly token budget, view usage |
| **6** | User-facing token visibility — show remaining credits in sidebar/AI settings |
| **7** | Email deliverability — verified sending domain for production |
| **8** | UI styling and responsive design — unified Tailwind scale across all screens |

### Routing Logic (Batch 3+)

```
any sensitive chunks in context → Ollama
openAiEnabled = false           → Ollama
tokensUsed >= budget            → Ollama
otherwise                       → OpenAI
```

For the full checklist with test plans, see **[`implementation-plan.md`](implementation-plan.md)**.

---

## Features

- **RAG Chat** — Streamed AI responses grounded in org-specific knowledge
- **Multi-tenant Orgs** — Scoped resources, embeddings, and conversations per organization
- **File & Web Ingestion** — PDF, DOCX, XLSX, TXT, MD, CSV; web crawl with BFS
- **Hybrid Search** — Vector + keyword with RRF and reranking
- **Citations** — Source highlighting and retrieval from KB via tools
- **Chat Attachments** — PDF, TXT, images (non-RAG) passed as context
- **Auth** — Better Auth (sign-in, sign-up, email verification, password reset)
- **Admin Panel** — Org management, sources, file folders, member invites
- **Testing** — Unit, integration, E2E with Jest and Playwright

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension enabled
- OpenAI API key **or** a running [Ollama](https://ollama.com) instance

### Installation

```bash
git clone <repository-url>
cd aura-ai
npm install
cp .env.example .env
```

Configure `.env` (minimum required):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# AI — choose one:
OPENAI_API_KEY="sk-..."          # cloud (OpenAI)
# AI_PROVIDER=ollama             # local (Ollama) — set OLLAMA_BASE_URL too

# Email (optional for local dev — see below)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="onboarding@resend.dev"

# File storage (optional — needed for file uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
AWS_S3_BUCKET=
NEXT_PUBLIC_AWS_S3_BUCKET=
NEXT_PUBLIC_AWS_REGION=
```

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local development (no domain required)

- **Resend test sender**: set `RESEND_FROM_EMAIL=onboarding@resend.dev` — no domain verification needed.
- **Invites in dev**: if Resend rejects an invite email (common in test mode), the server logs the invite link so you can copy/paste it and continue testing.
- **Self-serve org creation (dev-only)**: set `DEV_ALLOW_SELF_ORG_CREATION=1` to allow any signed-in user to create an organization without needing a superadmin role.

### OpenAI vs Ollama

| Mode | `AI_PROVIDER` | Requirements |
|------|--------------|-------------|
| Cloud (default) | `openai` | `OPENAI_API_KEY` |
| Local / on-prem | `ollama` | Ollama running at `OLLAMA_BASE_URL` (default: `http://localhost:11434`) |

When using Ollama, the `web_search` tool is automatically disabled (OpenAI-only).

### Testing

```bash
npm test                 # Unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage
npm run test:e2e         # Playwright E2E
```

---

## Project Structure

```
├── app/
│   ├── (auth)/           # Sign-in, sign-up, verify, reset
│   ├── (admin)/          # Admin org management
│   ├── api/
│   │   ├── ai/chat/      # Chat streaming, RAG context, tools
│   │   ├── files/rag/    # RAG file upload
│   │   └── org/sources/  # Web source indexing
│   └── ...
├── components/
│   ├── ai/               # Chat UI, sidebar, input
│   ├── org/              # Org settings, files, sources
│   └── ui/               # Shadcn components
├── lib/
│   ├── rag/
│   │   ├── chunking.ts   # Sentence-aware chunking
│   │   ├── embeddings.ts # Embedding generation
│   │   ├── search.ts     # Hybrid search, RRF, rerank
│   │   ├── crawl.ts      # Web crawling
│   │   └── upload/       # File ingestion actions
│   ├── ai-provider.ts    # Provider factory (OpenAI/Ollama)
│   └── attachments-server.ts
├── prisma/
└── email/                # Resend templates
```

---

## License

MIT
