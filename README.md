# AuraAI — Your Company's AI That Actually Knows Your Business

Most AI tools are generic. AuraAI is not.

AuraAI is an AI chat platform built for organizations that want their AI to answer questions using **their own documents, websites, and internal knowledge** — not just whatever was in a public training dataset. Ask it about your internal policies, product specs, client contracts, or anything else you've uploaded, and it gives you accurate, cited answers in seconds.

---

## Why AuraAI?

Every business has knowledge locked in files, wikis, PDFs, and websites that employees can't quickly search through. AuraAI solves this by letting your AI **read and reason over your own content** — so staff get instant, trustworthy answers instead of digging through folders or waiting for a colleague to respond.

### Sensitive data stays on your premises

Most AI tools send everything to the cloud. That's fine for general questions, but **not for confidential contracts, HR files, financial reports, or legally sensitive documents**.

AuraAI runs entirely on **[Ollama](https://ollama.com)** — an open-source AI runtime you host yourself. Every document, every chat message, and every embedding is processed inside your own infrastructure. **Nothing leaves your network.**

Because the model itself never contacts the cloud, the privacy guarantee applies to every document by default — no special tagging required.

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

- **Chunking**: ~1200 chars target, 2-sentence overlap, sentence-aware splits with hard 1500-char cap to respect the embedding model's context window; `startOffset`/`endOffset` kept for source highlighting
- **Embeddings**: Ollama `nomic-embed-text` — 768-dim vectors stored in pgvector

### Hybrid Search

- **Vector search**: pgvector cosine similarity (`<=>`) with configurable thresholds
- **Keyword search**: PostgreSQL full-text (`to_tsvector` + `plainto_tsquery`, `ts_rank`)
- **Fusion**: Reciprocal Rank Fusion (RRF) combines both result sets
- **Reranking**: Jaccard-based word overlap boost (70% RRF + 30% keyword overlap)

### Chat Flow

1. Validate session and org membership
2. **Pre-retrieval**: Top 8 chunks from hybrid search over last user message
3. Build system prompt + knowledge base context + user context + optional attachment context
4. Tool: `retrieve_context` (follow-up KB search for multi-turn conversations)
5. Stream response via AI SDK; persist messages; send citation metadata for source highlighting

### Stack

| Layer      | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | Next.js 15, React 19, TypeScript, Tailwind, Radix/Shadcn |
| Auth      | Better Auth (sessions, org membership, email verification) |
| Database  | PostgreSQL, Prisma ORM, pgvector                        |
| AI        | Vercel AI SDK + Ollama (`nomic-embed-text` + configurable chat model) |
| Storage   | AWS S3 (file uploads)                                   |
| Email     | Resend                                                  |
| Monitoring| Sentry                                                  |
| Testing   | Jest, React Testing Library, Playwright                 |

---

## Features

- **RAG Chat** — Streamed AI responses grounded in org-specific knowledge, running fully on-premise
- **Multi-tenant Orgs** — Scoped resources, embeddings, and conversations per organization
- **File & Web Ingestion** — PDF, DOCX, XLSX, TXT, MD, CSV; web crawl with BFS
- **Hybrid Search** — Vector + keyword with RRF and reranking
- **Citations** — Source highlighting and retrieval from KB via tools
- **Chat Attachments** — PDF, TXT, images (non-RAG) passed as context
- **Auth** — Better Auth (sign-in, sign-up, email verification, password reset, invite flow)
- **Admin Panel** — Org management, sources, file folders, member invites
- **Testing** — Unit, integration, E2E with Jest and Playwright

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension enabled
- [Ollama](https://ollama.com) running locally or on a server

### Install Ollama models

```bash
ollama pull nomic-embed-text   # embeddings (required)
ollama pull llama3.1           # chat (or any model you prefer)
```

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

# Ollama (required)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

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

### Local development

- **Ollama must be running** — start it with `ollama serve` before launching the dev server.
- **Resend test sender**: set `RESEND_FROM_EMAIL=onboarding@resend.dev` — no domain verification needed.
- **Invites in dev**: if Resend rejects an invite email (common in test mode), the server logs the invite link so you can copy/paste it and continue testing.
- **Self-serve org creation (dev-only)**: set `DEV_ALLOW_SELF_ORG_CREATION=1` to allow any signed-in user to create an organization without needing a superadmin role.

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
│   │   ├── files/rag/    # RAG file upload + embedding
│   │   └── org/sources/  # Web source indexing
│   └── ...
├── components/
│   ├── ai/               # Chat UI, sidebar, input
│   ├── org/              # Org settings, files, sources
│   └── ui/               # Shadcn components
├── lib/
│   ├── rag/
│   │   ├── chunking.ts   # Sentence-aware chunking with hard char cap
│   │   ├── embeddings.ts # Embedding generation via Ollama
│   │   ├── search.ts     # Hybrid search, RRF, rerank, dimension check
│   │   ├── crawl.ts      # Web crawling
│   │   └── upload/       # File ingestion actions
│   ├── ai-provider.ts    # Ollama model factory
│   └── attachments-server.ts
├── prisma/
└── email/                # Resend templates
```

For the full development roadmap and batch checklists, see **[`implementation-plan.md`](implementation-plan.md)**.

---

## License

MIT
