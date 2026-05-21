# IntelliDoc AI V2

Welcome to the **IntelliDoc AI V2** platform. This is an enterprise-grade, AI-first intelligent document workspace. Users can upload thousands of documents, group them into Knowledge Bases, chat with their data using native Server-Sent Events, visualize metrics, and manage subscriptions—all wrapped in a stunning modern Glassmorphism design system.

## 🏗 System Architecture

The application is split into two primary monoliths that communicate via REST APIs and background webhooks, backed by a sprawling Docker infrastructure.

### Frontend: Next.js 15
- **Framework**: Next.js 15 (App Router, Server Actions)
- **Styling**: Tailwind CSS v4, shadcn/ui, native CSS Glassmorphism tokens
- **State Management**: Zustand (for the RAG Chat Store and SSE parsing)
- **Auth**: Auth.js (NextAuth v5) with Credentials, Google, and GitHub
- **Database ORM**: Prisma ORM (connected to PostgreSQL)
- **Object Storage**: AWS SDK v3 connecting natively to MinIO

### Backend: FastAPI & AI Service
- **Framework**: Python 3.11 FastAPI
- **LLM Orchestration**: LangChain, OpenAI (`gpt-4o`, `text-embedding-3-small`)
- **Document Parsing**: Unstructured.io (PDF, Word, CSV, MD parsing)
- **Vector DB**: Qdrant (Semantic Search)
- **Knowledge Graph**: Neo4j (Entity visualization & relationships)
- **Message Broker**: RabbitMQ & Celery (Async document processing)

---

## 🚀 Quick Start Guide

You will need Docker Desktop and Node.js (v20+) installed.

### 1. Configure the AI Service
You must provide an OpenAI API key for the embedding and generation models to work.
```bash
echo "OPENAI_API_KEY=your_sk_key_here" > ai_service/.env
```

### 2. Launch the Infrastructure
Boot up PostgreSQL, Redis, RabbitMQ, Neo4j, Qdrant, MinIO, and the FastAPI application in the background:
```bash
docker-compose up -d --build
```

### 3. Setup the Database
Migrate the Prisma schema into your local Postgres container:
```bash
npx prisma db push
```

### 4. Start the Application
Install frontend dependencies and start the Next.js development server:
```bash
npm install
npm run dev
```

Visit `http://localhost:3000/register` to create your first account and log into the beautiful dashboard!

---

## 📸 Core Features
- **SSE Chat Interface**: "ChatGPT-like" streaming responses with citation tracking below messages.
- **Dynamic Data Hydration**: Uploading a document natively pipes the byte buffer to MinIO, saves metadata to Postgres, and pings the FastAPI server asynchronously to generate Vectors without blocking the UI.
- **Glassmorphism UI**: Glowing borders, translucent backgrounds, blurred gradients, and micro-animations built deeply into `globals.css` and the layout.
