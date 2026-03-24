# AuraAI — RAG-Powered AI Chat for Organizations

A full-stack AI chat application built with Next.js 15, featuring a **Retrieval-Augmented Generation (RAG)** pipeline, multi-tenant organization management, hybrid search over document embeddings, and support for both cloud (OpenAI) and on-prem (Ollama) models.

---

## Why This Project?

This repo demonstrates production-grade AI/ML engineering: RAG pipelines, vector search, hybrid retrieval, document ingestion (files + web crawls), streaming chat, and flexible model routing. It’s built as a modern SaaS-style app with auth, org scoping, and observability in mind.

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
- **Embeddings**: OpenAI `text-embedding-3-small` (1536-dim); batches of 50 for rate limits

### Hybrid Search

- **Vector search**: pgvector cosine similarity (`<=>`) with configurable thresholds
- **Keyword search**: PostgreSQL full-text (`to_tsvector` + `plainto_tsquery`, `ts_rank`)
- **Fusion**: Reciprocal Rank Fusion (RRF) combines both result sets
- **Reranking**: Jaccard-based word overlap boost (70% RRF + 30% keyword overlap)

### Chat Flow

1. Validate session and org membership
2. **Pre-retrieval**: Top 8 chunks from hybrid search over last user message
3. Build system prompt + knowledge base context + user context + optional attachment context
4. Tools: `retrieve_context` (follow-up KB search) and `web_search` (OpenAI)
5. Stream response via AI SDK; persist messages; send citation metadata for source highlighting

### Stack

| Layer      | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | Next.js 15, React 19, TypeScript, Tailwind, Radix/Shadcn |
| Auth      | Better Auth (sessions, org membership, email verification) |
| Database  | PostgreSQL, Prisma ORM, pgvector                        |
| AI        | Vercel AI SDK, OpenAI GPT-4o-mini, text-embedding-3-small |
| Email     | Resend                                                  |
| Monitoring| Sentry                                                  |
| Testing   | Jest, React Testing Library, Playwright                 |

---

## Development Roadmap: Ollama + OpenAI Flexibility

The system is being extended to support **on-prem (Ollama)** alongside **cloud (OpenAI)** with intelligent routing.

### Planned Capabilities

| Batch | Goal |
|-------|------|
| **1** | Ollama provider (embeddings + chat); provider factory in `lib/ai-provider.ts`; migrate embeddings to 768-dim (Ollama nomic-embed-text) |
| **2** | Document `sensitive` flag — mark docs at upload; surface in search for routing |
| **3** | **Chat routing** — route to Ollama when any retrieved doc is sensitive, org disables OpenAI, or token budget is exhausted; otherwise use OpenAI |
| **4** | Token tracking — count OpenAI tokens per org, enforce monthly cap, reset logic |
| **5** | Admin UI — toggle OpenAI per org, set monthly token budget, view usage |
| **6** | User-facing token visibility — show remaining credits in sidebar/AI settings |

### Routing Logic (Batch 3+)

```
any sensitive chunks in context → Ollama
openAiEnabled = false           → Ollama
tokensUsed >= budget            → Ollama
otherwise                       → OpenAI
```

---

## Features

- **RAG Chat** — Streamed AI responses grounded in org-specific knowledge
- **Multi-tenant Orgs** — Scoped resources, embeddings, and conversations per organization
- **File & Web Ingestion** — PDF, DOCX, XLSX, TXT, MD, CSV; web crawl with BFS
- **Hybrid Search** — Vector + keyword with RRF and reranking
- **Citations** — Source highlighting and retrieval from KB via tools
- **Chat Attachments** — PDF, TXT, images (non-RAG) passed as context
- **Auth** — Better Auth (sign-in, sign-up, email verification, password reset)
- **Admin Panel** — Org management, sources, token controls (planned)
- **Testing** — Unit, integration, E2E with Jest and Playwright

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector
- OpenAI API key (for embeddings and chat)

### Installation

```bash
git clone <repository-url>
cd aura-ai
npm install
cp .env.example .env.local
```

Configure `.env.local`:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"
OPENAI_API_KEY="..."
RESEND_API_KEY="..."       # optional, for email
NEXT_PUBLIC_SENTRY_DSN=""  # optional
SENTRY_DSN=""
```

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
└── docs/                 # Technical and implementation docs
```

---

## Docs

- [AI Technical Documentation](docs/ai-technical-documentation.md) — RAG pipeline, ingestion, search, chat flow
- [Ollama + OpenAI Implementation Plan](docs/ollama-openai-implementation-plan.md) — Roadmap for dual-provider support

---

## License

MIT
