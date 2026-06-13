<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

# 🧠 IntelliDoc AI

**The most modern AI-powered document intelligence platform.**

IntelliDoc AI lets you upload documents, semantically search across them, and have AI-powered conversations with your files — complete with verifiable citations, confidence scoring, and knowledge base management. Built with a production-grade microservices architecture.

---

## ✨ Features

### Core Intelligence
- **📄 Document Upload & Processing** — Upload PDFs, DOCX, TXT, and CSV files. Documents are parsed, semantically chunked, and embedded into a vector database automatically.
- **💬 RAG Chat with Citations** — Chat with your documents using GPT-4o. Every response includes source citations with page numbers and confidence scores so you can verify answers.
- **🔍 Semantic Search** — Find meaning across your entire document repository using vector similarity, not just keyword matching.
- **📚 Knowledge Bases** — Organize documents into Knowledge Bases for team-scoped conversations and retrieval.

### Platform
- **🔐 Multi-Provider Auth** — Sign in with Google, GitHub, or email/password credentials via NextAuth v5.
- **💳 Subscription & Payments** — Integrated Razorpay payment gateway with Free, Pro, and Enterprise tiers.
- **📊 Analytics Dashboard** — Track document usage, chat activity, and system metrics with interactive Recharts visualizations.
- **🌗 Dark/Light Theme** — Beautiful, responsive UI with full dark mode support and smooth transitions.
- **📱 Responsive Design** — Works seamlessly across desktop, tablet, and mobile viewports.

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
| **Frontend** | Next.js 15.5, React 19, TailwindCSS 4 | UI, SSR, API routes, auth, payments |
| **AI Service** | FastAPI, LangChain, OpenAI | Document parsing, embeddings, RAG chat |
| **Database** | PostgreSQL (Neon) + Prisma ORM | Users, documents, conversations, payments |
| **Vector Store** | Qdrant Cloud | Semantic search and document retrieval |
| **Object Storage** | AWS S3 / Cloudflare R2 / MinIO | Raw document file storage |
| **Message Queue** | RabbitMQ (CloudAMQP) | Async document processing pipeline |
| **Cache** | Redis | Session caching and job queues (BullMQ) |

---

## 📁 Project Structure

```
intellidoc/
├── src/                          # Next.js Frontend
│   ├── app/
│   │   ├── (auth)/               # Login & registration pages
│   │   ├── (dashboard)/          # Protected app pages
│   │   │   ├── analytics/        # Usage analytics
│   │   │   ├── billing/          # Subscription management
│   │   │   ├── chat/             # AI chat interface
│   │   │   ├── dashboard/        # Home dashboard
│   │   │   ├── documents/        # Document management
│   │   │   ├── knowledge-bases/  # Knowledge base CRUD
│   │   │   ├── pricing/          # Plan selection
│   │   │   └── settings/         # User settings
│   │   ├── api/                  # Next.js API routes
│   │   │   ├── auth/             # NextAuth endpoints
│   │   │   ├── conversations/    # Chat API (proxies to FastAPI)
│   │   │   ├── documents/        # Document CRUD
│   │   │   ├── payments/         # Razorpay integration
│   │   │   ├── subscriptions/    # Plan management
│   │   │   ├── upload/           # File upload handler
│   │   │   ├── user/             # User profile API
│   │   │   └── webhooks/         # Razorpay webhooks
│   │   ├── globals.css           # Global styles & design tokens
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   ├── chat/                 # Chat UI components
│   │   ├── layout/               # Sidebar, navbar, etc.
│   │   ├── payments/             # Payment modals
│   │   └── ui/                   # Shared UI primitives (shadcn/ui)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities (db, api, auth helpers)
│   ├── store/                    # Zustand state management
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
│   │   └── embedding_service.py  # OpenAI text-embedding-3-small
│   ├── retrieval/
│   │   └── qdrant_client.py      # Qdrant vector store operations
│   ├── llm/
│   │   └── rag_chain.py          # LangChain RAG with GPT-4o
│   ├── workers/
│   │   └── rabbitmq_consumer.py  # Async document processing
│   ├── main.py                   # FastAPI application entrypoint
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Container build
│
├── prisma/
│   └── schema.prisma             # Database schema (15 models)
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
| [Recharts](https://recharts.org/) | Data visualization |
| [NextAuth v5](https://authjs.dev/) | Authentication (Google, GitHub, Credentials) |
| [Prisma 6](https://www.prisma.io/) | Type-safe database ORM |

### AI Backend
| Technology | Purpose |
|-----------|---------|
| [FastAPI](https://fastapi.tiangolo.com/) | High-performance Python API |
| [LangChain](https://langchain.com/) | RAG orchestration framework |
| [OpenAI GPT-4o](https://openai.com/) | LLM for chat responses |
| [OpenAI text-embedding-3-small](https://openai.com/) | Document embeddings (1536 dims) |
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

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Python** 3.11+
- **Docker** & **Docker Compose** (for local infrastructure)
- An **OpenAI API key** ([get one here](https://platform.openai.com/api-keys))

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

# AI
OPENAI_API_KEY=sk-your-openai-api-key
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
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

# Copy and configure environment
cp ../.env .env
# Edit .env to set QDRANT_URL, OPENAI_API_KEY, RABBITMQ_URL, etc.

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
| `GET` | `/api/documents` | List user's documents |
| `PATCH` | `/api/documents/[id]` | Update document metadata/status |
| `DELETE` | `/api/documents/[id]` | Delete a document |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations` | List user's conversations |
| `POST` | `/api/conversations/[id]/messages` | Send a chat message (SSE stream) |
| `GET` | `/api/conversations/[id]/messages` | Get conversation history |
| `POST` | `/api/payments/create-order` | Create a Razorpay payment order |
| `POST` | `/api/webhooks/razorpay` | Razorpay webhook handler |
| `GET/PATCH` | `/api/user/profile` | Get or update user profile |

### FastAPI AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/chat` | RAG chat with SSE streaming |
| `POST` | `/api/v1/retrieve` | Retrieve relevant chunks from Qdrant |
| `POST` | `/api/v1/documents/process` | Trigger document processing pipeline |

### Chat Request Example

```bash
curl -X POST https://your-ai-service.onrender.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key terms in the contract?",
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

The application uses **15 Prisma models** across these domains:

| Domain | Models |
|--------|--------|
| **Auth** | `User`, `Account`, `Session`, `VerificationToken` |
| **Documents** | `Document`, `Chunk`, `KnowledgeBase` |
| **Chat** | `Conversation`, `Message`, `Citation`, `MessageFeedback` |
| **Teams** | `Team`, `TeamMember` |
| **Payments** | `Payment`, `Subscription`, `WebhookEvent` |

Key relationships:
- A **User** owns Documents, Conversations, and Subscriptions
- **Documents** belong to optional Knowledge Bases
- **Conversations** contain Messages with Citations
- **Messages** support user feedback (thumbs up/down)

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
    │  ├─ Download file from S3
    │  ├─ Parse document (PyMuPDF / Docx2txt)
    │  ├─ Chunk text (RecursiveCharacterTextSplitter)
    │  ├─ Generate embeddings (text-embedding-3-small)
    │  ├─ Upsert vectors to Qdrant
    │  └─ Update status in PostgreSQL (status: INDEXED)
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
