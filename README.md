<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Gemini_AI-2.0-4285F4?logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

# 🧠 IntelliDoc AI

**The most modern AI-powered document intelligence platform.**

IntelliDoc AI lets you upload documents, semantically search across them, and have AI-powered conversations with your files — complete with verifiable citations, confidence scoring, auto-generated summaries, and knowledge base management. Built with a production-grade microservices architecture and designed for multi-tenant team collaboration.

---

## ✨ Features

### Core Intelligence
- **📄 Document Upload & Processing** — Upload PDFs, DOCX, PPTX, TXT, Markdown, CSV, and JSON files. Documents are parsed, semantically chunked, and embedded into a vector database automatically with real-time progress tracking.
- **💬 RAG Chat with Citations** — Chat with your documents using Gemini AI or GPT-4o. Every response includes source citations with match percentages and confidence scores so you can verify answers.
- **🔍 Semantic Search** — Find meaning across your entire document repository using vector similarity with cross-encoder re-ranking, not just keyword matching.
- **📚 Knowledge Bases** — Organize documents into Knowledge Bases for scoped conversations and retrieval. Chat can be restricted to a specific knowledge base.
- **🧾 Auto-Generated Summaries** — When documents are processed, the AI automatically generates a summary and suggested starter questions to help users get started quickly.
- **🔄 Cross-Encoder Re-Ranking** — Retrieved documents are re-ranked using a cross-encoder model for more accurate and relevant search results.
- **🌐 Corrective RAG (CRAG)** — When retrieval confidence is low, the system automatically triggers a web search via Tavily to supplement context, evaluates source quality, and refines the answer — ensuring high-quality responses even for edge-case queries.
- **📊 RAGAS Evaluation** — Built-in evaluation pipeline using RAGAS metrics (faithfulness, answer relevancy, context precision, context recall) to continuously measure and improve RAG response quality.
- **⚠️ Hallucination Detection** — Automatic hallucination scoring on AI responses with visual warnings when confidence is low, so users always know when to double-check an answer.
- **📤 Chat Export** — Export any conversation as a beautifully formatted Markdown file or a professional PDF document, with source citations preserved.
- **🔗 Shared Links** — Generate secure, expiring share links for documents and conversations. Anyone with the link can view the resource without logging in.
- **🎙️ Voice Input (Whisper)** — Record audio queries via the browser microphone. Audio is transcribed by OpenAI Whisper with a mandatory human-in-the-loop review step before submission. Redis-backed rate limiting and SHA-256 transcript caching prevent abuse and duplicate API calls.

### 📂 Document Management
- **Folder Organization** — Create nested folders within workspaces to organize documents hierarchically. Drag-and-drop uploads directly into folders.
- **Document Preview** — In-browser preview for PDFs and text files with metadata sidebar showing file size, upload date, chunk count, and embedding model used.
- **Multi-File Upload** — Upload multiple files simultaneously with real-time progress bars for each file.
- **Drag & Drop** — Drag files directly onto the upload zone for instant processing.
- **Status Tracking** — Real-time document status tracking (Pending → Processing → Indexed) with automatic polling.

### 🤝 Team Workspaces & Collaboration
IntelliDoc is built from the ground up for multi-tenant team collaboration. The entire application is scoped around **Workspaces**:
- **Role-Based Access Control (RBAC)** — Assign `OWNER`, `ADMIN`, or `MEMBER` roles to granularly control who can invite users, manage billing, or modify knowledge bases.
- **Secure Invitations** — Send beautifully formatted email invitations via SMTP or generate shareable invite links for rapid team onboarding.
- **Isolated Data Silos** — Every workspace acts as a strict tenant boundary. Documents, conversations, and vectors never leak across workspaces.
- **Shared Knowledge** — Upload documents and organize them into shared Knowledge Bases that any workspace member can query and interact with.
- **Team Management** — Full team management dashboard for inviting members, changing roles, and removing users.

### ⚙️ Settings & Account Management
- **Profile Management** — Update name, upload/remove profile picture, and manage account details.
- **API Key Management** — Bring your own OpenAI and/or Gemini API keys. A system default Gemini key is provided for free-tier users.
- **Security & Access** — Change password, enable/disable Two-Factor Authentication (2FA).
- **Notification Preferences** — Configure email digest, document processing alerts, security alerts, and new feature announcements.
- **Appearance** — Switch between Light, Dark, and System themes with smooth transitions.

### Platform
- **🔐 Multi-Provider Auth** — Sign in with Google, GitHub, or email/password credentials via NextAuth v5.
- **💳 Subscription & Payments** — Integrated Razorpay payment gateway with Free, Pro, and Enterprise tiers.
- **📊 Analytics Dashboard** — Track total documents, query volume, vector storage usage, and active users with interactive Recharts visualizations (bar charts, area charts). Includes real-time system infrastructure health monitoring.
- **🌗 Dark/Light Theme** — Beautiful, responsive UI with full dark mode support and smooth transitions.
- **📱 Responsive Design** — Works seamlessly across desktop, tablet, and mobile viewports with mobile-optimized drawers and card layouts.
- **📧 Email System** — Transactional email service (Nodemailer + SMTP) for password resets, workspace invitations, and contact form submissions.
- **📬 Contact Form** — Public contact page with email notification to the site owner.
- **📜 Legal Pages** — Privacy policy and Terms of Service pages included.
- **🤖 Multi-Model AI** — Supports both Google Gemini and OpenAI GPT-4o. Users can bring their own API key or use the system default.
- **🎓 Onboarding Tour** — Interactive guided tour (React Joyride) to walk new users through key features on first login.

---

## 🏗️ Architecture

IntelliDoc uses a **two-service microservices architecture** connected by a message queue:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Next.js Frontend  │  ← Vercel (Edge + Serverless)
                    │   (React 19 + SSR)  │
                    └──────┬────────┬─────┘
                           │        │
              ┌────────────▼─┐   ┌──▼────────────────┐
              │  PostgreSQL  │   │   FastAPI Backend  │  ← Render
              │  (Neon DB)   │   │   (AI Service)     │
              │  via Prisma  │   └──┬─────┬─────┬────┘
              └──────────────┘      │     │     │
                          ┌─────────▼┐  ┌─▼──┐  ┌▼──────────┐
                          │  Qdrant  │  │ S3 │  │ RabbitMQ  │
                          │ (Vectors)│  │    │  │  (Queue)  │
                          └──────────┘  └────┘  └───────────┘
```

### Service Breakdown

| Service | Technology | Responsibility |
|---------|-----------|----------------|
| **Frontend** | Next.js 15.5, React 19, TailwindCSS 4 | UI, SSR, API routes, auth, payments, email |
| **AI Service** | FastAPI, LangChain, Gemini/OpenAI | Document parsing, embeddings, re-ranking, RAG chat, CRAG, RAGAS evaluation |
| **Database** | PostgreSQL (Neon) + Prisma ORM | Users, documents, conversations, payments, workspaces |
| **Vector Store** | Qdrant Cloud | Semantic search, re-ranking, and document retrieval |
| **Object Storage** | AWS S3 / Cloudflare R2 / MinIO | Raw document file storage |
| **Message Queue** | RabbitMQ (CloudAMQP) | Async document processing pipeline |
| **Cache** | Redis | Voice transcript caching, rate limiting, and session management |
| **Email** | Nodemailer (SMTP) | Transactional emails (invites, password resets, contact) |

---

## 📁 Project Structure

```
intellidoc/
├── src/                              # Next.js Frontend & API
│   ├── app/
│   │   ├── (auth)/                   # Auth pages
│   │   │   ├── login/                # Login page
│   │   │   ├── register/             # Registration page
│   │   │   ├── forgot-password/      # Forgot password page
│   │   │   ├── reset-password/       # Password reset page
│   │   │   └── verify-email/         # Email verification page
│   │   ├── (dashboard)/              # Protected app pages
│   │   │   ├── analytics/            # Usage analytics & system health
│   │   │   ├── billing/              # Subscription management
│   │   │   ├── chat/                 # AI chat interface with export & share
│   │   │   ├── dashboard/            # Home dashboard
│   │   │   ├── documents/            # Document management with folders
│   │   │   │   └── [id]/             # Document preview & detail page
│   │   │   ├── knowledge-bases/      # Knowledge base CRUD
│   │   │   ├── pricing/              # Plan selection
│   │   │   └── settings/             # User settings (profile, API keys, security)
│   │   │       └── team/             # Team & workspace management
│   │   ├── api/                      # Next.js API routes
│   │   │   ├── analytics/            # Workspace analytics data
│   │   │   ├── auth/                 # NextAuth endpoints
│   │   │   ├── contact/              # Contact form handler
│   │   │   ├── conversations/        # Conversation CRUD
│   │   │   │   └── [id]/             # Single conversation
│   │   │   │       └── messages/     # Chat messages (SSE stream)
│   │   │   │           └── resolve/  # CRAG web-search resolution endpoint
│   │   │   ├── documents/            # Document CRUD
│   │   │   │   ├── upload/           # Upload handler
│   │   │   │   └── [id]/             # Single document + download
│   │   │   │       └── download/     # File download/preview
│   │   │   ├── folders/              # Folder CRUD (create, list, delete)
│   │   │   ├── invite/               # Invitation accept/verify
│   │   │   ├── knowledge-bases/      # Knowledge base CRUD
│   │   │   ├── payments/             # Razorpay integration
│   │   │   ├── shared-links/         # Generate & resolve shared links
│   │   │   ├── subscriptions/        # Plan management
│   │   │   ├── upload/               # Generic file upload handler
│   │   │   ├── user/                 # User management
│   │   │   │   ├── key/              # API key CRUD (OpenAI, Gemini)
│   │   │   │   ├── notifications/    # Notification preferences
│   │   │   │   ├── password/         # Password change
│   │   │   │   └── profile/          # Profile update (name, image)
│   │   │   ├── voice/                # Voice input
│   │   │   │   ├── transcribe/       # Whisper transcription endpoint
│   │   │   │   └── __tests__/        # Voice API tests
│   │   │   ├── webhooks/             # Razorpay webhook handler
│   │   │   └── workspaces/           # Workspace CRUD
│   │   │       └── [id]/             # Single workspace
│   │   │           ├── invite/       # Send invitations
│   │   │           └── members/      # Member management
│   │   ├── contact/                  # Public contact page
│   │   ├── invite/                   # Invitation landing page
│   │   ├── privacy/                  # Privacy policy page
│   │   ├── shared/                   # Shared resource viewer (public)
│   │   │   └── [token]/              # View shared docs/conversations
│   │   ├── terms/                    # Terms of service page
│   │   ├── globals.css               # Global styles & design tokens
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing page
│   ├── actions/                      # Server actions
│   │   ├── documents.ts              # Document server actions
│   │   └── knowledge-bases.ts        # Knowledge base server actions
│   ├── components/
│   │   ├── chat/                     # Chat UI components
│   │   │   ├── ChatSidebar.tsx       # Conversation list sidebar
│   │   │   ├── VoiceInputButton.tsx  # Microphone recording button
│   │   │   ├── WebSearchConfirmCard.tsx # CRAG web search confirmation
│   │   │   ├── chat-input.tsx        # Message input bar
│   │   │   ├── chat-messages.tsx     # Message display with citations
│   │   │   └── suggestion-button.tsx # Suggested question buttons
│   │   ├── dashboard/                # Dashboard components
│   │   │   ├── activity-row.tsx      # Activity feed row
│   │   │   └── stat-card.tsx         # Statistics card
│   │   ├── documents/                # Document components
│   │   │   ├── document-cards.tsx    # Card grid view
│   │   │   ├── document-dialogs.tsx  # Create/edit dialogs
│   │   │   ├── document-table.tsx    # Table view
│   │   │   └── upload-section.tsx    # Upload dropzone
│   │   ├── knowledge-bases/          # Knowledge base components
│   │   │   ├── add-existing-dialog.tsx
│   │   │   ├── kb-documents-cards.tsx
│   │   │   └── kb-documents-table.tsx
│   │   ├── layout/                   # App shell components
│   │   │   ├── MainSidebar.tsx       # Primary navigation sidebar
│   │   │   ├── OnboardingTour.tsx    # Guided onboarding tour
│   │   │   ├── WorkspaceSwitcher.tsx # Workspace selector dropdown
│   │   │   ├── bottom-nav.tsx        # Mobile bottom navigation
│   │   │   ├── logout-button.tsx     # Logout action button
│   │   │   └── mobile-drawer.tsx     # Mobile hamburger drawer
│   │   ├── payments/                 # Payment components
│   │   │   └── RazorpayCheckout.tsx  # Razorpay checkout modal
│   │   ├── settings/                 # Settings page components
│   │   │   ├── api-settings.tsx      # API key management
│   │   │   ├── notification-settings.tsx
│   │   │   ├── profile-settings.tsx  # Profile editor
│   │   │   └── security-settings.tsx # Password & 2FA
│   │   ├── team/                     # Team management components
│   │   │   ├── invite-dialog.tsx     # Invitation modal
│   │   │   ├── members-table.tsx     # Members list table
│   │   │   └── workspace-dialog.tsx  # Workspace create/edit
│   │   ├── ui/                       # Shared UI primitives (shadcn/ui)
│   │   ├── auth-provider.tsx         # Auth session provider
│   │   ├── theme-provider.tsx        # Theme context provider
│   │   └── theme-toggle.tsx          # Light/dark mode toggle
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-api-keys.ts           # API key management hook
│   │   ├── use-chat.ts               # Chat interaction hook
│   │   ├── use-documents.ts          # Document CRUD hook
│   │   ├── use-kb-details.ts         # Knowledge base details hook
│   │   ├── use-notification-settings.ts
│   │   ├── use-profile-settings.ts   # Profile management hook
│   │   ├── use-security-settings.ts  # Security settings hook
│   │   ├── use-team-settings.ts      # Team management hook
│   │   └── use-voice-recorder.ts     # Microphone recording hook
│   ├── lib/                          # Shared utilities
│   │   ├── api.ts                    # API client helpers
│   │   ├── dashboard-data.ts         # Dashboard stats aggregation
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── email.ts                  # Email service (reset, invite, contact)
│   │   ├── export-chat.ts            # Chat export (Markdown & PDF)
│   │   ├── hallucination.ts          # Hallucination score utilities
│   │   ├── jwt.ts                    # JWT token utilities
│   │   ├── rabbitmq.ts               # RabbitMQ publisher
│   │   ├── razorpay.ts               # Razorpay client & helpers
│   │   ├── redis/                    # Redis client configuration
│   │   ├── session.ts                # Session management
│   │   ├── storage.ts                # S3/MinIO storage helpers
│   │   ├── utils.ts                  # General utilities (cn, etc.)
│   │   └── vectorStore.ts            # Qdrant vector store client
│   ├── middleware/                    # Server-side middleware
│   │   ├── authMiddleware.ts         # JWT auth verification
│   │   ├── rateLimiter.ts            # Redis-based rate limiting
│   │   └── roleGuard.ts             # RBAC permission guard
│   ├── store/                        # Zustand state management
│   │   ├── chat-store.ts             # Chat UI state
│   │   ├── conversation-store.ts     # Conversation & messages state
│   │   └── workspace-store.ts        # Active workspace state
│   ├── auth.ts                       # NextAuth v5 configuration
│   ├── env.ts                        # Zod-validated environment variables
│   └── middleware.ts                 # Edge middleware (auth guard + routing)
│
├── ai_service/                       # FastAPI AI Backend
│   ├── controllers/                  # Route handlers
│   │   ├── chat_controller.py        # RAG chat with SSE streaming
│   │   ├── document_controller.py    # Document processing orchestration
│   │   ├── evaluation_controller.py  # RAGAS evaluation handler
│   │   └── retrieval_controller.py   # Vector search handler
│   ├── routers/                      # FastAPI route definitions
│   │   ├── chat_router.py            # /api/v1/chat
│   │   ├── document_router.py        # /api/v1/documents/process
│   │   ├── evaluation_router.py      # /api/v1/evaluate
│   │   ├── health_router.py          # /health
│   │   └── retrieval_router.py       # /api/v1/retrieve
│   ├── core/                         # App configuration
│   │   ├── config.py                 # Pydantic settings
│   │   └── dependencies.py           # Dependency injection (Qdrant, etc.)
│   ├── crag/                         # Corrective RAG module
│   │   ├── evaluator.py              # Retrieval confidence evaluator
│   │   ├── models.py                 # CRAG data models
│   │   ├── pending_store.py          # Redis-based pending state
│   │   ├── refiner.py                # Context refinement logic
│   │   └── web_search.py             # Tavily web search integration
│   ├── embeddings/                   # Embedding pipeline
│   │   ├── embedding_service.py      # Multi-provider embeddings (Gemini/OpenAI)
│   │   └── semantic_chunker.py       # Recursive text splitting
│   ├── evaluation/                   # RAG quality evaluation
│   │   └── ragas_evaluator.py        # RAGAS metrics (faithfulness, relevancy, etc.)
│   ├── llm/                          # LLM integration
│   │   └── rag_chain.py              # RAG chain + summary & question generation
│   ├── parsers/                      # Document parsers
│   │   └── document_parser.py        # PDF (PyMuPDF), DOCX, TXT, CSV parsing
│   ├── retrieval/                    # Search & retrieval
│   │   ├── qdrant_client.py          # Qdrant vector store operations
│   │   └── reranker.py               # Cross-encoder re-ranking
│   ├── schemas/                      # Pydantic request/response models
│   │   ├── chat.py                   # Chat request/response schemas
│   │   ├── document.py               # Document processing schemas
│   │   ├── evaluation.py             # RAGAS evaluation schemas
│   │   └── retrieval.py              # Retrieval schemas
│   ├── services/                     # Business logic layer
│   │   ├── auth_service.py           # API key extraction & validation
│   │   ├── chat_service.py           # Chat orchestration logic
│   │   └── document_service.py       # Document processing pipeline
│   ├── workers/                      # Background workers
│   │   └── rabbitmq_consumer.py      # Async RabbitMQ document processing consumer
│   ├── scripts/                      # Migration & utility scripts
│   │   └── migrate_chunks.py         # Chunk migration utility
│   ├── tests/                        # Python test suite
│   │   └── test_ragas_failure_modes.py # RAGAS evaluation edge case tests
│   ├── main.py                       # FastAPI application entrypoint
│   ├── run_baseline.py               # Baseline evaluation runner
│   ├── check_queue.py                # RabbitMQ queue inspection utility
│   ├── requirements.txt              # Python dependencies
│   ├── pytest.ini                    # Pytest configuration
│   └── Dockerfile                    # Container build
│
├── prisma/
│   ├── schema.prisma                 # Database schema (17 models)
│   ├── seed.ts                       # Database seed script
│   └── migrations/                   # Prisma migration files
│
├── docker-compose.yml                # Local dev stack (Postgres, Redis, RabbitMQ, MinIO, Qdrant, Neo4j)
├── render.yaml                       # Render deployment blueprint
├── vercel.json                       # Vercel deployment config
├── package.json                      # Node.js dependencies
├── tsconfig.json                     # TypeScript configuration
├── eslint.config.mjs                 # ESLint configuration
├── postcss.config.mjs                # PostCSS configuration
├── components.json                   # shadcn/ui configuration
└── .env.example                      # Environment variable template
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| [Next.js 15.5](https://nextjs.org/) | React framework with App Router & Turbopack |
| [React 19](https://react.dev/) | UI library |
| [TailwindCSS 4](https://tailwindcss.com/) | Utility-first CSS |
| [Framer Motion](https://www.framer.com/motion/) | Animations & transitions |
| [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) | Accessible component primitives |
| [Zustand](https://zustand.surge.sh/) | Lightweight state management |
| [TanStack Query](https://tanstack.com/query) + [SWR](https://swr.vercel.app/) | Server state & data fetching |
| [TanStack Table](https://tanstack.com/table) | Headless table component |
| [Recharts](https://recharts.org/) + [D3](https://d3js.org/) | Data visualization (bar, area charts) |
| [NextAuth v5](https://authjs.dev/) | Authentication (Google, GitHub, Credentials) |
| [Prisma 6](https://www.prisma.io/) | Type-safe database ORM |
| [React Markdown](https://github.com/remarkjs/react-markdown) | Markdown rendering for AI responses |
| [jsPDF](https://github.com/parallax/jsPDF) | Client-side PDF generation for chat export |
| [Nodemailer](https://nodemailer.com/) | Transactional email service |
| [Sonner](https://sonner.emilkowal.dev/) | Toast notifications |
| [React Joyride](https://react-joyride.com/) | Guided onboarding tours |
| [Zod](https://zod.dev/) | Runtime schema validation |

### AI Backend
| Technology | Purpose |
|-----------|---------|
| [FastAPI](https://fastapi.tiangolo.com/) | High-performance async Python API |
| [LangChain](https://langchain.com/) | RAG orchestration framework |
| [Google Gemini](https://ai.google.dev/) | LLM for chat responses & embeddings |
| [OpenAI GPT-4o](https://openai.com/) | Alternative LLM for chat responses |
| [Whisper](https://openai.com/research/whisper) | Audio transcription (via OpenAI SDK) |
| [scikit-learn](https://scikit-learn.org/) | Cross-encoder re-ranking |
| [Qdrant](https://qdrant.tech/) | Vector similarity search |
| [Tavily](https://tavily.com/) | Web search for Corrective RAG (CRAG) |
| [PyMuPDF](https://pymupdf.readthedocs.io/) + [pytesseract](https://github.com/madmaze/pytesseract) | PDF/image parsing with OCR |
| [aio-pika](https://aio-pika.readthedocs.io/) | Async RabbitMQ consumer |
| [tiktoken](https://github.com/openai/tiktoken) | Token counting for context windows |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| [Vercel](https://vercel.com/) | Frontend hosting (Edge + Serverless) |
| [Render](https://render.com/) | AI service hosting |
| [Neon](https://neon.tech/) | Serverless PostgreSQL |
| [Qdrant Cloud](https://cloud.qdrant.io/) | Managed vector database |
| [CloudAMQP](https://www.cloudamqp.com/) | Managed RabbitMQ |
| [Cloudflare R2](https://www.cloudflare.com/r2/) / AWS S3 | Object storage |
| [Razorpay](https://razorpay.com/) | Payment processing |
| [Redis](https://redis.io/) | Caching, rate limiting & session management |
| [Docker Compose](https://docs.docker.com/compose/) | Local development orchestration |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Python** 3.11+
- **Docker** & **Docker Compose** (for local infrastructure)
- A **Gemini API key** ([get one free here](https://aistudio.google.com/app/apikey)) or **OpenAI API key** ([get one here](https://platform.openai.com/api-keys))

### 1. Clone the Repository

```bash
git clone https://github.com/nitingupta95/intellidoc.git
cd intellidoc
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials. At minimum you need:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/intellidoc

# Auth
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI (at least one is required)
OPENAI_API_KEY=sk-your-openai-api-key

NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Email (Optional, for invitations and contact form)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

### 3. Start Infrastructure Services

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, RabbitMQ, MinIO, Qdrant, and Neo4j.

### 4. Set Up the Frontend

```bash
# Install dependencies
npm install

# Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

The frontend will be available at **http://localhost:3000**.

### 5. Set Up the AI Service

```bash
cd ai_service

# Create virtual environment
python -m venv venv
source venv/bin/activate    # macOS/Linux
# venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The AI service will be available at **http://localhost:8000**.

### 6. Verify

- Open http://localhost:3000 — you should see the IntelliDoc landing page
- Open http://localhost:8000/health — should return `{"status": "healthy"}`
- Register an account and upload a PDF to test the full pipeline

---

## ☁️ Production Deployment

### Frontend → Vercel

1. Push your code to GitHub
2. Import the repository on [Vercel](https://vercel.com/new)
3. Set environment variables in Vercel Dashboard → Settings → Environment Variables:

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
APP_URL=https://your-domain.vercel.app
AUTH_URL=https://your-domain.vercel.app
AUTH_TRUST_HOST=true
AUTH_SECRET=<your-secret>
NEXT_PUBLIC_API_URL=https://your-ai-service.onrender.com/api/v1
DATABASE_URL=<your-neon-postgres-url>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

4. Deploy. Vercel will automatically build and deploy on every push to `main`.

### AI Service → Render

1. Create a new **Web Service** on [Render](https://render.com/)
2. Connect your GitHub repository
3. Set the **Root Directory** to `ai_service`
4. Set the **Build Command** to `pip install -r requirements.txt`
5. Set the **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables:

```env
OPENAI_API_KEY=<your-key>
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=<your-qdrant-api-key>
RABBITMQ_URL=amqps://...@warthog.rmq.cloudamqp.com/...
ALLOWED_ORIGIN=https://your-domain.vercel.app
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
S3_BUCKET=<your-bucket>
S3_ENDPOINT=<your-s3-endpoint>
TAVILY_API_KEY=<your-tavily-key>
```

### Google OAuth Setup

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
1. Add `https://your-domain.vercel.app` to **Authorized JavaScript origins**
2. Add `https://your-domain.vercel.app/api/auth/callback/google` to **Authorized redirect URIs**

---

## 📡 API Reference

### Next.js API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a document (multipart/form-data) |
| `GET` | `/api/documents` | List workspace documents |
| `GET` | `/api/documents/[id]` | Get document details (metadata, summary) |
| `GET` | `/api/documents/[id]/download` | Download/preview original file |
| `PATCH` | `/api/documents/[id]` | Update document metadata/status |
| `DELETE` | `/api/documents/[id]` | Delete a document |
| `POST` | `/api/documents/upload` | Upload with document metadata |
| `GET/POST` | `/api/folders` | List or create folders |
| `GET/PATCH/DELETE` | `/api/folders/[id]` | Get, update, or delete a folder |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations` | List user's conversations |
| `POST` | `/api/conversations/[id]/messages` | Send a chat message (SSE stream) |
| `GET` | `/api/conversations/[id]/messages` | Get conversation history |
| `POST` | `/api/conversations/[id]/messages/resolve` | Resolve CRAG web search confirmation |
| `POST` | `/api/voice/transcribe` | Transcribe audio via Whisper |
| `GET/POST` | `/api/knowledge-bases` | List or create knowledge bases |
| `GET/POST` | `/api/shared-links` | Generate or list shared links |
| `GET/POST/DELETE` | `/api/workspaces` | Workspace CRUD |
| `GET/POST/DELETE` | `/api/workspaces/[id]/members` | Manage workspace members |
| `POST` | `/api/workspaces/[id]/invite` | Invite users to workspace |
| `GET` | `/api/invite/[token]` | Verify invitation token |
| `POST` | `/api/invite/accept` | Accept an invitation |
| `GET` | `/api/analytics` | Workspace analytics data |
| `POST` | `/api/payments/create-order` | Create a Razorpay payment order |
| `POST` | `/api/webhooks/razorpay` | Razorpay webhook handler |
| `GET/PATCH` | `/api/user/profile` | Get or update user profile (name, image) |
| `GET/POST/DELETE` | `/api/user/key` | Manage API keys (OpenAI, Gemini) |
| `POST` | `/api/user/password` | Change password |
| `GET/POST` | `/api/user/notifications` | Manage notification preferences |
| `GET/POST` | `/api/subscriptions` | Subscription management |
| `POST` | `/api/contact` | Submit contact form |

### FastAPI AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/chat` | RAG chat with SSE streaming + CRAG + re-ranking |
| `POST` | `/api/v1/retrieve` | Retrieve relevant chunks from Qdrant |
| `POST` | `/api/v1/documents/process` | Trigger document processing pipeline |
| `POST` | `/api/v1/evaluate` | Run RAGAS evaluation on a response |

### Chat Request Example

```bash
curl -X POST https://your-ai-service.onrender.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-gemini-api-key: YOUR_GEMINI_KEY" \
  -d '{
    "query": "What are the key terms in the contract?",
    "workspace_id": "ws_123",
    "document_ids": ["doc_id_1", "doc_id_2"],
    "history": [],
    "knowledge_base_id": null
  }'
```

**Response** (SSE stream):
```
data: {"event": "citations", "data": [{"score": 0.92, "text_snippet": "...", "metadata": {...}}]}
data: The key terms in the contract include...
data: [DONE]
```

---

## 🗄️ Database Schema

The application uses **17 Prisma models** across these domains:

| Domain | Models |
|--------|--------|
| **Auth** | `User`, `Account`, `Session`, `VerificationToken` |
| **Documents** | `Document`, `Chunk`, `KnowledgeBase`, `Folder` |
| **Chat** | `Conversation`, `Message`, `Citation`, `MessageFeedback` |
| **Workspaces** | `Workspace`, `WorkspaceMember`, `Invitation` |
| **Sharing** | `SharedLink` |
| **Payments** | `Payment`, `Subscription`, `WebhookEvent` |

Key relationships:
- A **User** owns Documents, Conversations, SharedLinks, and Subscriptions
- **Documents** belong to optional Knowledge Bases and Folders
- **Folders** support nesting (self-referential parent/child)
- **Conversations** contain Messages with Citations
- **Messages** include RAGAS evaluation scores (faithfulness, answer relevancy, context precision, context recall) and hallucination scores
- **Messages** support user feedback (thumbs up/down)
- **SharedLinks** enable public access to documents and conversations with expiration and access counting
- **Workspaces** contain Folders, Documents, Knowledge Bases, and Conversations with role-based member access (`OWNER`, `ADMIN`, `MEMBER`)

---

## 🔄 Document Processing Pipeline

```
Upload (Browser)
    │
    ▼
Next.js /api/upload
    │  ├─ Save metadata to PostgreSQL (status: PENDING)
    │  ├─ Upload file to S3/MinIO
    │  └─ Publish message to RabbitMQ
    │
    ▼
RabbitMQ Consumer (ai_service)
    │
    ▼
FastAPI /api/v1/documents/process
    │  ├─ Download file from S3           (10%)
    │  ├─ Parse document (PyMuPDF/Docx2txt) (30%)
    │  ├─ Chunk text (RecursiveCharacterTextSplitter) (50%)
    │  ├─ Generate embeddings (Gemini/OpenAI) (70%)
    │  ├─ Upsert vectors to Qdrant        (90%)
    │  ├─ Generate summary & suggested questions (95%)
    │  └─ Update status in PostgreSQL (status: INDEXED) (100%)
    │
    ▼
Ready for Chat & Search
```

---

## 🎙️ Voice Input (Whisper) Pipeline

```
User taps mic (Frontend)
    │
MediaRecorder captures audio (record-then-send architecture)
    │
POST /api/voice/transcribe (multipart)
    │
Redis rate-limit check (per-user, per-minute window)
    │
Redis cache check (SHA-256 of audio) ──hit──> return cached transcript
    │ miss
Whisper API (whisper-1 via OpenAI SDK)
    │
Cache transcript in Redis (1 hour TTL)
    │
Transcript returned to frontend (editable, not auto-sent)
    │
User reviews/edits → presses send
    │
Existing RAG chat pipeline (unchanged)
```

---

## 🌐 Corrective RAG (CRAG) Pipeline

When retrieval confidence is low, IntelliDoc automatically enhances context with web search:

```
User sends query
    │
    ▼
Qdrant retrieval + cross-encoder re-ranking
    │
    ▼
CRAG Evaluator scores retrieval confidence
    │
    ├─ HIGH confidence (> 0.7) → Use retrieved context directly
    │
    ├─ LOW confidence (< 0.3) → Trigger Tavily web search
    │                           → Refine & merge web results with local context
    │
    └─ AMBIGUOUS (0.3–0.7) → Ask user to confirm web search
                             → Store pending state in Redis
                             → User confirms via /messages/resolve endpoint
    │
    ▼
LLM generates response with enriched context
```

---

## 🏗️ System Design & Future Scaling

IntelliDoc is architected with **progressive scalability** in mind — start simple, scale deliberately. The system is designed so that every component can be independently scaled or replaced without rewriting application code.

### Current Architecture (Small Scale — MVP / Early Production)

The current deployment model is optimized for **speed-to-market, low cost, and zero server administration**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT DEPLOYMENT                                │
│                       (Serverless / Managed Services)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐       │
│   │   Vercel      │     │   Render      │     │   Managed Services   │       │
│   │  (Frontend)   │────▶│  (AI Service) │────▶│                      │       │
│   │  Edge + SSR   │     │  Single Inst. │     │  • Neon (Postgres)   │       │
│   │  Auto-scales  │     │  Free/Starter │     │  • Qdrant Cloud      │       │
│   └──────────────┘     └──────────────┘     │  • CloudAMQP          │       │
│                                              │  • Cloudflare R2      │       │
│                                              │  • Redis Cloud        │       │
│                                              └──────────────────────┘       │
│                                                                             │
│   Cost: ~$0–$50/month  │  Users: 1–500  │  Documents: <10K                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this works for small scale:**

| Aspect | Justification |
|--------|---------------|
| **Frontend (Vercel)** | Automatic edge caching, serverless functions, global CDN, zero-config SSL. Handles traffic spikes natively via edge functions. |
| **AI Service (Render)** | Single-instance deployment is sufficient when document processing is async via RabbitMQ. The main API (`/chat`, `/retrieve`) is lightweight and serves one request at a time with streaming. |
| **Database (Neon)** | Serverless Postgres with auto-suspend. Scales to zero when idle, handles connection pooling automatically. Perfect for variable traffic patterns. |
| **Queue (CloudAMQP)** | Managed RabbitMQ eliminates the need to monitor queue health. The free tier supports up to 1M messages/month, which covers ~10K document uploads. |
| **Vector DB (Qdrant Cloud)** | Managed vector search with built-in HNSW indexing. No need to tune ANN parameters or manage index sharding at this scale. |

> **💡 Key Design Decision:** All service-to-service communication uses environment variables (`QDRANT_URL`, `RABBITMQ_URL`, `DATABASE_URL`). This means switching from a managed service to a self-hosted service (or vice-versa) requires only changing the URL — no code changes.

---

### Scaling Stage 1: Vertical Scaling & Optimization (500–5,000 Users)

Before reaching for Kubernetes, there are several optimizations that provide **10x throughput without infrastructure changes**:

#### 1.1 — AI Service Horizontal Scaling on Render

```
                    ┌──────────────────────┐
                    │    Load Balancer      │
                    │    (Render built-in)  │
                    └──────┬───────┬───────┘
                           │       │
                    ┌──────▼──┐ ┌──▼──────┐
                    │ Worker 1│ │ Worker 2│   ← Render allows scaling
                    │ FastAPI │ │ FastAPI │      to multiple instances
                    └─────────┘ └─────────┘
```

- Scale Render to **2–4 instances** of the AI Service ($25–$50/month each).
- RabbitMQ naturally distributes document processing jobs across multiple consumers — no code changes needed.
- Each worker competes for messages from the queue, providing **automatic load distribution**.

#### 1.2 — Database Connection Pooling

```python
# Current: Direct connection (fine for <50 concurrent queries)
DATABASE_URL=postgresql://user:pass@host/db

# Scaled: Connection pooling via PgBouncer or Neon's built-in pooler
DATABASE_URL=postgresql://user:pass@host/db?pgbouncer=true&connection_limit=50
```

- Neon provides built-in connection pooling. Switch to pooled connection strings.
- Add Redis caching for frequently accessed data (workspace metadata, user profiles, subscription status).
- Add database indexes for hot query paths (document listing, conversation history).

#### 1.3 — CDN & Static Asset Optimization

- Vercel already handles this, but add explicit `Cache-Control` headers for API responses.
- Cache document metadata responses in Redis with a 60-second TTL.
- Serve pre-signed S3 download URLs directly from the frontend, bypassing the API for file downloads.

#### 1.4 — Embedding Batch Processing

- Currently, documents are embedded one chunk at a time. Batch embeddings requests (Gemini supports up to 100 texts per `embed_content` call) for **5–10x faster document processing**.
- Implement a priority queue in RabbitMQ: small documents (< 5 pages) get fast-tracked, large documents (100+ pages) are processed in a background priority.

---

### Scaling Stage 2: Kubernetes & Container Orchestration (5,000–100,000+ Users)

When managed services hit their limits (cost, latency, compliance), move to a **self-hosted Kubernetes cluster** on AWS EKS, GKE, or Azure AKS.

#### 2.1 — Production Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES CLUSTER (AWS EKS / GKE)                          │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        INGRESS CONTROLLER (NGINX)                          │    │
│  │               TLS Termination • Rate Limiting • Path Routing               │    │
│  └──────────┬──────────────────────┬──────────────────────┬───────────────────┘    │
│             │                      │                      │                        │
│  ┌──────────▼──────────┐ ┌────────▼─────────┐ ┌─────────▼─────────┐              │
│  │   NAMESPACE: web     │ │ NAMESPACE: ai     │ │ NAMESPACE: data   │              │
│  │                      │ │                    │ │                    │              │
│  │  ┌────────────────┐ │ │ ┌──────────────┐  │ │ ┌──────────────┐  │              │
│  │  │  Next.js App   │ │ │ │  FastAPI API  │  │ │ │  PostgreSQL  │  │              │
│  │  │  Deployment    │ │ │ │  Deployment   │  │ │ │  StatefulSet │  │              │
│  │  │  replicas: 3   │ │ │ │  replicas: 3  │  │ │ │  replicas: 3 │  │              │
│  │  │  HPA: 2–10     │ │ │ │  HPA: 2–20   │  │ │ │  (Primary +  │  │              │
│  │  └────────────────┘ │ │ └──────────────┘  │ │ │   2 Replicas) │  │              │
│  │                      │ │                    │ │ └──────────────┘  │              │
│  │  ┌────────────────┐ │ │ ┌──────────────┐  │ │                    │              │
│  │  │  Static Assets │ │ │ │  Doc Workers │  │ │ ┌──────────────┐  │              │
│  │  │  (CDN Origin)  │ │ │ │  Deployment   │  │ │ │    Qdrant    │  │              │
│  │  └────────────────┘ │ │ │  replicas: 5  │  │ │ │  StatefulSet │  │              │
│  │                      │ │ │  HPA: 2–50   │  │ │ │  replicas: 3 │  │              │
│  └──────────────────────┘ │ │  (CPU-based)  │  │ │ │  (Sharded)   │  │              │
│                            │ └──────────────┘  │ │ └──────────────┘  │              │
│                            │                    │ │                    │              │
│                            │ ┌──────────────┐  │ │ ┌──────────────┐  │              │
│                            │ │   RabbitMQ    │  │ │ │    Redis     │  │              │
│                            │ │  StatefulSet  │  │ │ │   Sentinel   │  │              │
│                            │ │  replicas: 3  │  │ │ │  replicas: 3 │  │              │
│                            │ │  (Clustered)  │  │ │ └──────────────┘  │              │
│                            │ └──────────────┘  │ │                    │              │
│                            └────────────────────┘ └────────────────────┘              │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                      NAMESPACE: monitoring                                  │    │
│  │                                                                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │  Prometheus   │  │   Grafana    │  │    Loki      │  │  AlertManager│   │    │
│  │  │  (Metrics)    │  │ (Dashboards) │  │   (Logs)     │  │  (Alerts)    │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.2 — Horizontal Pod Autoscaling (HPA) Strategy

| Service | Scale Metric | Min Pods | Max Pods | Scale-Up Trigger |
|---------|-------------|----------|----------|--------------------|
| **Next.js Frontend** | CPU utilization | 2 | 10 | CPU > 70% for 60s |
| **FastAPI API** | Request rate (RPS) | 2 | 20 | > 100 RPS sustained |
| **Document Workers** | RabbitMQ queue length | 2 | 50 | Queue depth > 50 messages |
| **Qdrant** | Memory utilization | 3 | 6 | Memory > 80% |

**Why this matters for IntelliDoc:**
- A user uploads 200 documents at once → RabbitMQ queue depth spikes → K8s scales doc workers from 2 to 20 within 60 seconds → all 200 documents are processed in ~5 minutes instead of 2 hours → workers scale back down to 2 after the queue drains, saving costs.

---

### Scaling Comparison Summary

| Aspect | Current (MVP) | Stage 1 (Optimized) | Stage 2 (Kubernetes) |
|--------|---------------|--------------------|----------------------|
| **Users** | 1–500 | 500–5,000 | 5,000–100,000+ |
| **Documents** | < 10K | 10K–100K | 100K–10M+ |
| **Monthly Cost** | $0–$50 | $50–$300 | $500–$5,000+ |
| **Frontend** | Vercel (Free) | Vercel (Pro) | K8s + CDN |
| **AI Service** | Render (1 inst.) | Render (2–4 inst.) | K8s HPA (2–50 pods) |
| **Database** | Neon Serverless | Neon Pro | RDS + Read Replicas |
| **Monitoring** | Vercel Analytics | Basic Prometheus | Full Grafana Stack |
| **Deploy Time** | ~30s (Vercel) | ~30s (Vercel) | ~2min (Helm) |
| **Recovery (MTTR)** | Manual restart | Manual restart | Auto-healing (< 30s) |
| **Scaling Speed** | Instant (Edge) | Manual (Render UI) | Auto (HPA, < 60s) |

> **🎯 Philosophy:** Don't scale before you need to. The current Vercel + Render + Managed Services stack handles the first 500 users with zero operational overhead. Move to Kubernetes only when you need fine-grained autoscaling, self-hosting compliance, or cost optimization at volume.

---

## 🧪 Development

### Useful Commands

```bash
# Frontend
npm run dev           # Start dev server with Turbopack
npm run build         # Production build
npm run lint          # Run ESLint
npx prisma studio    # Open Prisma database GUI
npx prisma db push   # Push schema changes to database

# AI Service
cd ai_service
uvicorn main:app --reload --port 8000  # Dev server with hot reload
pytest                                  # Run test suite

# Infrastructure
docker compose up -d    # Start all services
docker compose down     # Stop all services
docker compose logs -f  # Follow logs
```

### Environment Validation

The app uses **Zod** to validate all environment variables at startup. If a required variable is missing, you'll see a clear warning in the console with the exact field that failed validation.

### Testing

- **Frontend**: Voice API tests located in `src/app/api/voice/__tests__/`
- **AI Service**: RAGAS evaluation tests in `ai_service/tests/test_ragas_failure_modes.py`
- **Test Frameworks**: Vitest (frontend, via `@vitest/coverage-v8`) and pytest (AI service)

```bash
# Run AI service tests
cd ai_service && pytest

# Run frontend tests (when configured)
npm test
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) — AI models for chat and embeddings
- [OpenAI](https://openai.com/) — GPT-4o, Whisper, and embedding models
- [LangChain](https://langchain.com/) — RAG orchestration
- [Qdrant](https://qdrant.tech/) — Vector similarity search
- [Tavily](https://tavily.com/) — Web search for Corrective RAG
- [Vercel](https://vercel.com/) — Frontend hosting
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful component primitives
- [Prisma](https://prisma.io/) — Type-safe database access

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/nitingupta95">Nitin Gupta</a>
</p>
