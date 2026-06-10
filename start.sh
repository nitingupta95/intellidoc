#!/bin/bash

# IntelliDoc AI V2 - Quick Start Script

echo "🚀 Starting IntelliDoc AI V2 ecosystem..."

# 1. Check for AI Service ENV
if [ ! -f "ai_service/.env" ]; then
    echo "⚠️ ai_service/.env not found! Creating template..."
    echo "OPENAI_API_KEY=your_key_here" > ai_service/.env
    echo "Please edit ai_service/.env to add your OpenAI API key."
fi

# 2. Boot Docker Infrastructure
echo "🐳 Starting Docker containers (Postgres, Redis, RabbitMQ, Neo4j, Qdrant, MinIO, FastAPI)..."
docker-compose up -d --build

# 3. Wait for Postgres to be ready
echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 5

# 4. Push Prisma Schema
echo "🗄 Syncing Prisma database schema..."
npx prisma db push

# 5. Start Next.js Development Server
echo "⚡ Starting Next.js UI on http://localhost:3000..."
npm run dev
