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
- **📤 Chat Export** — Export any conversation as a beautifully formatted Markdown file or a professional PDF document, with source citations preserved.
- **🔗 Shared Links** — Generate secure, expiring share links for documents and conversations. Anyone with the link can view the resource without logging in.

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
| **AI Service** | FastAPI, LangChain, Gemini/OpenAI | Document parsing, embeddings, re-ranking, RAG chat |
| **Database** | PostgreSQL (Neon) + Prisma ORM | Users, documents, conversations, payments, workspaces |
| **Vector Store** | Qdrant Cloud | Semantic search, re-ranking, and document retrieval |
| **Object Storage** | AWS S3 / Cloudflare R2 / MinIO | Raw document file storage |
| **Message Queue** | RabbitMQ (CloudAMQP) | Async document processing pipeline |
| **Cache** | Redis | Session caching and job queues (BullMQ) |
| **Email** | Nodemailer (SMTP) | Transactional emails (invites, password resets, contact) |

---

## 📁 Project Structure

```
intellidoc/
├── src/                          # Next.js Frontend
│   ├── app/
│   │   ├── (auth)/               # Login & registration pages
│   │   ├── (dashboard)/          # Protected app pages
│   │   │   ├── analytics/        # Usage analytics & system health
│   │   │   ├── billing/          # Subscription management
│   │   │   ├── chat/             # AI chat interface with export & share
│   │   │   ├── dashboard/        # Home dashboard
│   │   │   ├── documents/        # Document management with folders
│   │   │   │   └── [id]/         # Document preview & detail page
│   │   │   ├── knowledge-bases/  # Knowledge base CRUD
│   │   │   ├── pricing/          # Plan selection
│   │   │   └── settings/         # User settings (profile, API keys, security)
│   │   │       └── team/         # Team & workspace management
│   │   ├── api/                  # Next.js API routes
│   │   │   ├── analytics/        # Workspace analytics data
│   │   │   ├── auth/             # NextAuth endpoints
│   │   │   ├── contact/          # Contact form handler
│   │   │   ├── conversations/    # Chat API (proxies to FastAPI)
│   │   │   ├── documents/        # Document CRUD + download
│   │   │   ├── folders/          # Folder CRUD (create, list, delete)
│   │   │   ├── invite/           # Invitation accept/verify
│   │   │   ├── knowledge-bases/  # Knowledge base CRUD
│   │   │   ├── payments/         # Razorpay integration
│   │   │   ├── shared-links/     # Generate & resolve shared links
│   │   │   ├── subscriptions/    # Plan management
│   │   │   ├── upload/           # File upload handler
│   │   │   ├── user/             # Profile, API keys, password, notifications
│   │   │   ├── webhooks/         # Razorpay webhooks
│   │   │   └── workspaces/       # Workspace CRUD, members, invites
│   │   ├── contact/              # Public contact page
│   │   ├── invite/               # Invitation landing page
│   │   ├── privacy/              # Privacy policy page
│   │   ├── shared/               # Shared resource viewer (public)
│   │   │   └── [token]/          # View shared docs/conversations
│   │   ├── terms/                # Terms of service page
│   │   ├── globals.css           # Global styles & design tokens
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   ├── chat/                 # Chat UI components (sidebar, messages)
│   │   ├── layout/               # Sidebar, navbar, mobile drawer
│   │   ├── payments/             # Payment modals
│   │   └── ui/                   # Shared UI primitives (shadcn/ui)
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # API client helpers
│   │   ├── db.ts                 # Prisma client instance
│   │   ├── email.ts              # Email service (reset, invite, contact)
│   │   ├── export-chat.ts        # Chat export (Markdown & PDF)
│   │   ├── jwt.ts                # JWT token utilities
│   │   ├── queue.ts              # BullMQ job queue
│   │   ├── rabbitmq.ts           # RabbitMQ publisher
│   │   ├── razorpay.ts           # Razorpay client & helpers
│   │   ├── redis/                # Redis client configuration
│   │   ├── session.ts            # Session management
│   │   ├── storage.ts            # S3/MinIO storage helpers
│   │   └── vectorStore.ts        # Qdrant vector store client
│   ├── store/                    # Zustand state management
│   │   ├── chat-store.ts         # Chat UI state
│   │   ├── conversation-store.ts # Conversation & messages state
│   │   └── workspace-store.ts    # Active workspace state
│   ├── workers/
│   │   └── ingestionWorker.ts    # Background document ingestion worker
│   ├── types/                    # TypeScript type definitions
│   ├── auth.ts                   # NextAuth v5 configuration
│   ├── env.ts                    # Zod-validated environment variables
│   └── middleware.ts             # Edge middleware (auth guard)
│
├── ai_service/                   # FastAPI AI Backend
│   ├── core/
│   │   └── config.py             # Pydantic settings
│   ├── parsers/
│   │   └── document_parser.py    # PDF, DOCX, TXT, CSV parsing
│   ├── embeddings/
│   │   ├── semantic_chunker.py   # Recursive text splitting
│   │   └── embedding_service.py  # Multi-provider embeddings (Gemini/OpenAI)
│   ├── retrieval/
│   │   ├── qdrant_client.py      # Qdrant vector store operations
│   │   └── reranker.py           # Cross-encoder re-ranking
│   ├── llm/
│   │   └── rag_chain.py          # RAG chain + summary & question generation
│   ├── workers/
│   │   └── rabbitmq_consumer.py  # Async document processing consumer
│   ├── main.py                   # FastAPI application entrypoint
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Container build
│
├── prisma/
│   └── schema.prisma             # Database schema (20+ models)
│
├── docker-compose.yml            # Local development stack
├── render.yaml                   # Render deployment blueprint
├── vercel.json                   # Vercel deployment config
├── package.json                  # Node.js dependencies
└── .env.example                  # Environment variable template
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
| [shadcn/ui](https://ui.shadcn.com/) | Accessible component primitives |
| [Zustand](https://zustand.surge.sh/) | Lightweight state management |
| [TanStack Query](https://tanstack.com/query) | Server state & caching |
| [Recharts](https://recharts.org/) | Data visualization (bar, area charts) |
| [NextAuth v5](https://authjs.dev/) | Authentication (Google, GitHub, Credentials) |
| [Prisma 6](https://www.prisma.io/) | Type-safe database ORM |
| [React Markdown](https://github.com/remarkjs/react-markdown) | Markdown rendering for AI responses |
| [jsPDF](https://github.com/parallax/jsPDF) | Client-side PDF generation for chat export |
| [Nodemailer](https://nodemailer.com/) | Transactional email service |
| [Sonner](https://sonner.emilkowal.dev/) | Toast notifications |

### AI Backend
| Technology | Purpose |
|-----------|---------|
| [FastAPI](https://fastapi.tiangolo.com/) | High-performance Python API |
| [LangChain](https://langchain.com/) | RAG orchestration framework |
| [Google Gemini](https://ai.google.dev/) | LLM for chat responses & embeddings |
| [OpenAI GPT-4o](https://openai.com/) | Alternative LLM for chat responses |
| [Cross-Encoder](https://www.sbert.net/) | Re-ranking retrieved documents |
| [Qdrant](https://qdrant.tech/) | Vector similarity search |
| [PyMuPDF](https://pymupdf.readthedocs.io/) | PDF parsing |
| [aio-pika](https://aio-pika.readthedocs.io/) | Async RabbitMQ consumer |

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
| [Redis](https://redis.io/) | Session caching & job queues |

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
GEMINI_API_KEY=your_gemini_api_key        # Free from Google AI Studio
OPENAI_API_KEY=sk-your-openai-api-key     # Optional

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

This starts PostgreSQL, Redis, RabbitMQ, MinIO, and Qdrant.

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

# Copy and configure environment
cp ../.env .env
# Edit .env to set QDRANT_URL, GEMINI_API_KEY, RABBITMQ_URL, etc.

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
GEMINI_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>        # Optional
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=<your-qdrant-api-key>
RABBITMQ_URL=amqps://...@warthog.rmq.cloudamqp.com/...
ALLOWED_ORIGIN=https://your-domain.vercel.app
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
S3_BUCKET=<your-bucket>
S3_ENDPOINT=<your-s3-endpoint>
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
| `GET/POST` | `/api/folders` | List or create folders |
| `GET/PATCH/DELETE` | `/api/folders/[id]` | Get, update, or delete a folder |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations` | List user's conversations |
| `POST` | `/api/conversations/[id]/messages` | Send a chat message (SSE stream) |
| `GET` | `/api/conversations/[id]/messages` | Get conversation history |
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
| `POST` | `/api/contact` | Submit contact form |

### FastAPI AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/chat` | RAG chat with SSE streaming + re-ranking |
| `POST` | `/api/v1/retrieve` | Retrieve relevant chunks from Qdrant |
| `POST` | `/api/v1/documents/process` | Trigger document processing pipeline |

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

The application uses **20+ Prisma models** across these domains:

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
uvicorn main:app --reload --port 8000  # Dev server with hot reload

# Infrastructure
docker compose up -d    # Start all services
docker compose down     # Stop all services
docker compose logs -f  # Follow logs
```

### Environment Validation

The app uses **Zod** to validate all environment variables at startup. If a required variable is missing, you'll see a clear warning in the console with the exact field that failed validation.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) — AI models for chat and embeddings
- [OpenAI](https://openai.com/) — GPT-4o and embedding models
- [LangChain](https://langchain.com/) — RAG orchestration
- [Qdrant](https://qdrant.tech/) — Vector similarity search
- [Vercel](https://vercel.com/) — Frontend hosting
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful component primitives
- [Prisma](https://prisma.io/) — Type-safe database access

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/nitingupta95">Nitin Gupta</a>
</p>
