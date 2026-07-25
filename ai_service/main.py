import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import time
import json
import asyncio
import hashlib
import redis.asyncio as redis
from fastapi import Depends

from core.config import settings
from parsers.document_parser import DocumentParser
from embeddings.semantic_chunker import SemanticChunker
from embeddings.embedding_service import EmbeddingService
from retrieval.qdrant_client import QdrantVectorStore
from retrieval.reranker import reranker
from llm.rag_chain import RAGChain
from evaluation.ragas_evaluator import evaluator as ragas_evaluator
from workers.rabbitmq_consumer import consume

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend AI service handling document intelligence, embeddings, and chat.",
    version="2.0.0"
)

import os

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGIN], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def timer_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    logger.info(f"{request.url.path} took {duration:.3f}s")
    return response

# Initialize Services
parser = DocumentParser()
chunker = SemanticChunker()
embedding_svc = EmbeddingService()
rag_chain = RAGChain()

async def get_vector_store(provider: str = "openai", dimension: int = 1536):
    """
    Get or create QdrantVectorStore in app.state.
    """
    if not hasattr(app.state, "vector_stores"):
        app.state.vector_stores = {}
        
    key = f"{provider}_{dimension}"
    if key not in app.state.vector_stores:
        collection_name = f"documents_{provider}"
        logger.info(f"Initializing Vector Store for {collection_name} (dim {dimension})...")
        vs = QdrantVectorStore(collection_name=collection_name, dimension=dimension)
        await vs._ensure_collection()
        app.state.vector_stores[key] = vs
    return app.state.vector_stores[key]

class ChatRequest(BaseModel):
    query: str
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    history: Optional[List[dict]] = None
    # Phase 3 metadata filters
    team_id: Optional[str] = None
    department: Optional[str] = None
    project: Optional[str] = None

class DocumentProcessRequest(BaseModel):
    document_id: str
    file_path: str
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    uploaded_by: str
    metadata: dict = {}

consumer_task = None

@app.on_event("startup")
async def startup_event():
    global consumer_task
    logger.info("Initializing Redis client...")
    app.state.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    
    # Pre-initialize default Qdrant vector store
    await get_vector_store()
    
    logger.info("Starting RabbitMQ Consumer...")
    consumer_task = asyncio.create_task(consume())

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.redis.close()

# Mock Authentication Dependency
async def authenticate(authorization: Optional[str] = Header(None)):
    """Mock authentication dependency that checks a Redis auth cache."""
    if not authorization or not authorization.startswith("Bearer "):
        # For development, just return a dummy user if no token
        return {"user_id": "test_user", "role": "user"}
    
    token = authorization.split(" ")[1]
    redis_client = app.state.redis
    cache_key = f"auth:{token}"
    
    cached_user = await redis_client.get(cache_key)
    if cached_user:
        return json.loads(cached_user)
    
    # Simulate DB lookup & token decode
    user = {"user_id": "decoded_user_123", "role": "user"}
    await redis_client.setex(cache_key, 300, json.dumps(user)) # 5 min TTL
    return user

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

async def save_chat_to_db(chat_id: str, query: str, response: str, workspace_id: str):
    """Mock background task for persistence to Postgres."""
    await asyncio.sleep(0.05)
    logger.info(f"Saved chat {chat_id} to Postgres database.")

async def log_analytics_event(event_type: str, data: dict):
    """Mock background task for analytics & quota tracking."""
    await asyncio.sleep(0.02)
    logger.info(f"Logged analytics event: {event_type}")
    
async def compress_history_task(chat_id: str, history: list[dict], redis_client, openai_key, gemini_key):
    """Background task to compress history if it exceeds 10 messages."""
    if len(history) > 10:
        summary = await rag_chain.summarize_history(history, openai_key, gemini_key)
        # Store summary in Redis for next request
        await redis_client.setex(f"chat_summary:{chat_id}", 3600*24, summary)
        logger.info(f"Compressed history for chat {chat_id} into summary.")

@app.post("/api/v1/chat")
async def chat_endpoint(
    request: ChatRequest, 
    bg_tasks: BackgroundTasks,
    x_openai_api_key: Optional[str] = Header(None), 
    x_gemini_api_key: Optional[str] = Header(None),
    user: dict = Depends(authenticate)
):
    """
    RAG chat endpoint using SSE streaming.
    """
    logger.info(f"Received chat query: {request.query}")
    
    try:
        t0 = time.perf_counter()
        redis_client = app.state.redis
        
        # Hash the question for caching
        q_hash = hashlib.sha256(request.query.encode()).hexdigest()
        
        # 1. Full Response Cache Check
        # Key pattern: resp:{workspace_id}:{kb_id}:{doc_ids}:{q_hash}
        doc_ids_str = ",".join(sorted(request.document_ids)) if request.document_ids else "all"
        kb_id_str = request.knowledge_base_id or "none"
        full_resp_key = f"resp:{request.workspace_id}:{kb_id_str}:{doc_ids_str}:{q_hash}"
        
        cached_response = await redis_client.get(full_resp_key)
        if cached_response:
            logger.info("Full response cache hit!")
            async def cached_generator():
                yield f"data: {cached_response}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(cached_generator(), media_type="text/event-stream")
        
        # 2. Context Cache (Conversation-Scoped) Check
        # If the user is asking a follow up in the same session, we could reuse context.
        # But we don't have chat_id in request. Let's use a hash of the history as a proxy or just skip for now.
        # Wait, the prompt says "cache retrieved chunks per chat_id". 
        # I'll update ChatRequest to optionally include chat_id.
        chat_id = request.history[-1].get("chat_id", "default") if request.history else "default"
        ctx_cache_key = f"chat_ctx:{chat_id}"
        
        async def get_or_create_embedding(query, emb_cache_key):
            cached_emb = await redis_client.get(emb_cache_key)
            if cached_emb:
                logger.info("Embedding cache hit!")
                emb_data = json.loads(cached_emb)
                return emb_data["vector"], emb_data["provider"], emb_data["dim"]
            else:
                vector, prov, d = embedding_svc.embed_query(
                    query, 
                    openai_api_key=x_openai_api_key, 
                    gemini_api_key=x_gemini_api_key
                )
                await redis_client.setex(
                    emb_cache_key, 
                    30 * 24 * 3600, # 30 days
                    json.dumps({"vector": vector, "provider": prov, "dim": d})
                )
                return vector, prov, d

        async def fetch_chat_history(c_id: str):
            """Mock chat history fetch to demonstrate parallel I/O"""
            await asyncio.sleep(0.01) # simulate I/O
            return []
            
        # 3. Parallelize embedding and history fetch
        emb_cache_key = f"emb:{q_hash}"
        (query_vector, provider, dim), fetched_history = await asyncio.gather(
            get_or_create_embedding(request.query, emb_cache_key),
            fetch_chat_history(chat_id)
        )
        # If we had a real fetched_history, we could merge it with request.history here
        
        t_embed = time.perf_counter() - t0
        
        # 4. Retrieve from Vector DB (Qdrant) with larger limit for re-ranking
        t_search_start = time.perf_counter()
        
        # Check context cache first
        cached_ctx = await redis_client.get(ctx_cache_key)
        if cached_ctx and request.history and len(request.history) > 0:
            # Re-use context for follow-ups
            logger.info("Context cache hit! Reusing retrieved chunks.")
            search_results = []
            retrieved_docs = json.loads(cached_ctx)
            citations = [] # Or load citations from cache too
        else:
            vs = await get_vector_store(provider=provider, dimension=dim)
            search_results = await vs.search(
                query_vector=query_vector, 
                limit=15, 
                workspace_id=request.workspace_id,
                knowledge_base_id=request.knowledge_base_id,
                document_ids=request.document_ids,
                query_text=request.query,
                team_id=request.team_id,
                department=request.department,
                project=request.project
            )
            
            # 4.5 Re-rank with Cross-Encoder
            if search_results:
                logger.info(f"Re-ranking {len(search_results)} candidates...")
                search_results = reranker.rerank(request.query, search_results, top_k=5)
            
            # Extract text from payloads
            retrieved_docs = []
            citations = []
            for res in search_results:
                payload = res.payload or {}
                text = payload.get("content", "")
                retrieved_docs.append(text)
                citations.append({
                    "score": res.score,
                    "text_snippet": text[:150] + "..." if len(text) > 150 else text,
                    "full_text": text,
                    "metadata": payload.get("metadata", {})
                })
                
            if not retrieved_docs:
                retrieved_docs = ["No relevant context found in documents."]
                
            # Save to context cache for 10 minutes
            await redis_client.setex(ctx_cache_key, 600, json.dumps(retrieved_docs))
            
        t_search = time.perf_counter() - t_search_start

        # 5. Stream LLM Response via LangChain
        async def response_generator():
            t_llm_start = time.perf_counter()
            first_token_time = None
            
            # Yield citations first as a metadata event
            citations_event = f"data: {{\"event\": \"citations\", \"data\": {json.dumps(citations)}}}\n\n"
            yield citations_event
            
            full_answer = ""
            async for chunk in rag_chain.stream_answer(
                request.query, 
                retrieved_docs, 
                request.history, 
                openai_api_key=x_openai_api_key,
                gemini_api_key=x_gemini_api_key
            ):
                if first_token_time is None:
                    first_token_time = time.perf_counter() - t_llm_start
                
                # Format as Server-Sent Events (SSE) safely using json.dumps
                chunk_str = json.dumps(chunk)
                yield f"data: {chunk_str}\n\n"
                
                # If chunk is a string, accumulate it for caching
                if isinstance(chunk, str):
                    full_answer += chunk
                elif isinstance(chunk, dict) and "content" in chunk:
                    full_answer += chunk["content"]
                
            t_llm_total = time.perf_counter() - t_llm_start
            t_total = time.perf_counter() - t0
            
            metrics = {
                "embedding_time": round(t_embed, 3),
                "qdrant_search_time": round(t_search, 3),
                "llm_first_token_time": round(first_token_time, 3) if first_token_time else None,
                "llm_total_time": round(t_llm_total, 3),
                "total_time": round(t_total, 3)
            }
            logger.info(json.dumps({"event": "rag_query_metrics", "metrics": metrics}))
            
            # Cache the full response
            if full_answer:
                cache_payload = json.dumps({"content": full_answer, "cached": True})
                await redis_client.setex(full_resp_key, 43200, cache_payload) # 12 hours TTL
                
                # Phase 8: Move persistence, analytics, quota to Background Tasks
                bg_tasks.add_task(save_chat_to_db, chat_id, request.query, full_answer, request.workspace_id)
                bg_tasks.add_task(log_analytics_event, "chat_query", metrics)
                
                # Phase 4: History compression task
                if request.history:
                    bg_tasks.add_task(compress_history_task, chat_id, request.history, redis_client, x_openai_api_key, x_gemini_api_key)
                
            # Metrics have already been calculated and logged above
            
            yield "data: [DONE]\n\n"

        return StreamingResponse(response_generator(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        # Return a 500 but WITH the error string so we can see it in Vercel logs!
        from fastapi.responses import JSONResponse
        debug_info = {}
        try:
            vs = get_vector_store()
            debug_info["dir_client"] = dir(vs.client)
            debug_info["type_client"] = str(type(vs.client))
            import qdrant_client
            debug_info["version"] = getattr(qdrant_client, "__version__", "unknown")
        except:
            pass
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": str(e), "type": str(type(e)), "debug": debug_info})

class RetrieveRequest(BaseModel):
    query: str
    workspace_id: str
    limit: int = 5

@app.post("/api/v1/retrieve")
async def retrieve_endpoint(request: RetrieveRequest, x_openai_api_key: Optional[str] = Header(None), x_gemini_api_key: Optional[str] = Header(None)):
    """
    Endpoint for Next.js to retrieve chunks from Qdrant.
    """
    logger.info(f"Retrieving chunks for query: {request.query}")
    
    # Embed query
    query_vector, provider, dim = embedding_svc.embed_query(
        request.query, 
        openai_api_key=x_openai_api_key,
        gemini_api_key=x_gemini_api_key
    )
    
    # Retrieve from Qdrant with filter
    vs = await get_vector_store(provider=provider, dimension=dim)
    search_results = await vs.search(
        query_vector=query_vector, 
        limit=request.limit, 
        workspace_id=request.workspace_id
    )
    
    chunks = []
    for res in search_results:
        payload = res.payload or {}
        metadata = payload.get("metadata", {})
        chunks.append({
            "id": str(res.id),
            "docId": metadata.get("document_id", "unknown"),
            "pageNumber": metadata.get("page_number", 1),
            "text": payload.get("content", "")
        })
        
    return {"chunks": chunks}

import tempfile
import boto3
import httpx

async def update_document_status(document_id: str, data: dict):
    try:
        # Use ALLOWED_ORIGIN from environment variables (which points to the frontend URL)
        frontend_url = settings.ALLOWED_ORIGIN.rstrip("/")
        url = f"{frontend_url}/api/documents/{document_id}"
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(url, json=data)
    except Exception as e:
        logger.error(f"Failed to update document status in Next.js: {e}")

async def process_document_pipeline(file_path: str, document_id: str, workspace_id: str, uploaded_by: str, knowledge_base_id: Optional[str], metadata: dict, openai_api_key: str = None, gemini_api_key: str = None):
    """Background task for parsing, chunking, and embedding."""
    try:
        await update_document_status(document_id, {"status": "PROCESSING", "currentStep": "Downloading from MinIO", "progress": 10})
        # Download from MinIO to temporary file
        logger.info(f"Downloading {file_path} from MinIO...")
        
        s3 = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        # Extract object key if a URI was provided
        object_key = file_path
        if object_key.startswith("minio://"):
            parts = object_key.replace("minio://", "").split("/", 1)
            if len(parts) == 2:
                object_key = parts[1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            s3.download_file(settings.S3_BUCKET, object_key, tmp_file.name)
            local_path = tmp_file.name
            
        logger.info(f"Downloaded to local path: {local_path}")
        
        # 1. Parse
        await update_document_status(document_id, {"currentStep": "Parsing Document", "progress": 30})
        elements = parser.parse_document(local_path)
        
        # Inject document_id into metadata
        for el in elements:
            if "metadata" not in el:
                el["metadata"] = {}
            el["metadata"]["document_id"] = document_id
            el["metadata"]["workspace_id"] = workspace_id
            if knowledge_base_id:
                el["metadata"]["knowledge_base_id"] = knowledge_base_id
            el["metadata"]["uploaded_by"] = uploaded_by
            
        # 2. Chunk
        await update_document_status(document_id, {"currentStep": "Chunking text", "progress": 50})
        chunks = chunker.chunk_documents(elements)
        logger.info(f"Created {len(chunks)} chunks for {document_id}")
        
        if not chunks:
            logger.warning(f"No text chunks could be extracted from {file_path}. It might be an image-only PDF.")
            await update_document_status(document_id, {
                "status": "INDEXED", 
                "progress": 100,
                "currentStep": "Completed with warnings: No text found"
            })
            return
            
        # 3. Embed (Batched)
        await update_document_status(document_id, {"currentStep": "Generating Embeddings (Batched)", "progress": 70})
        texts = [c["content"] for c in chunks]
        
        batch_size = 100
        embeddings = []
        provider, dim = None, None
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_emb, prov, d = embedding_svc.embed_documents(
                batch_texts, 
                openai_api_key=openai_api_key, 
                gemini_api_key=gemini_api_key
            )
            embeddings.extend(batch_emb)
            if not provider:
                provider = prov
                dim = d
        
        # 4. Upsert to Qdrant
        await update_document_status(document_id, {"currentStep": "Saving to Vector Store", "progress": 90})
        vs = await get_vector_store(provider=provider, dimension=dim)
        await vs.upsert_chunks(chunks, embeddings)
        logger.info(f"Upserted {len(chunks)} vectors to Qdrant for {document_id}")
        
        # 5. Generate Summary and Questions
        await update_document_status(document_id, {"currentStep": "Generating Summary", "progress": 95})
        try:
            # Take first few chunks to summarize
            sample_text = " ".join([c["content"] for c in chunks[:5]])
            summary_data = await rag_chain.generate_summary_and_questions(
                sample_text, 
                openai_api_key=openai_api_key, 
                gemini_api_key=gemini_api_key
            )
        except Exception as summary_err:
            logger.error(f"Failed to generate summary: {summary_err}")
            summary_data = {"summary": None, "suggestedQuestions": None}
        
        # Success!
        await update_document_status(document_id, {
            "status": "INDEXED", 
            "currentStep": "Complete", 
            "progress": 100,
            "chunkCount": len(chunks),
            "embeddingModel": f"provider: {provider}, dim: {dim}",
            "summary": summary_data.get("summary"),
            "suggestedQuestions": summary_data.get("suggestedQuestions")
        })
        
    except Exception as e:
        logger.error(f"Pipeline failed for {document_id}: {e}")
        await update_document_status(document_id, {
            "status": "ERROR", 
            "errorMessage": str(e)
        })

@app.post("/api/v1/documents/process")
async def process_document(request: DocumentProcessRequest, bg_tasks: BackgroundTasks, x_openai_api_key: Optional[str] = Header(None), x_gemini_api_key: Optional[str] = Header(None)):
    """
    Triggers the document processing pipeline asynchronously.
    Enforces a maximum PDF size (e.g., 10 MiB) before queuing.
    """
    logger.info(f"Queuing document processing: {request.document_id}")
    # ---------------------------------------------------------------------
    # Validate uploaded PDF size (S3 object size) – prevents huge files.
    # ---------------------------------------------------------------------
    MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MiB limit
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        # Object key extraction (same logic as in pipeline)
        object_key = request.file_path
        if object_key.startswith("minio://"):
            parts = object_key.replace("minio://", "").split("/", 1)
            if len(parts) == 2:
                object_key = parts[1]
        head = s3.head_object(Bucket=settings.S3_BUCKET, Key=object_key)
        size = head.get("ContentLength", 0)
        if size > MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds maximum allowed size of {MAX_SIZE_BYTES // (1024 * 1024)} MiB."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify PDF size: {e}")
        # If we cannot determine size, let the pipeline handle it (or fail conservatively)
    # ---------------------------------------------------------------------
    # Queue background task after validation
    # ---------------------------------------------------------------------
    bg_tasks.add_task(
        process_document_pipeline,
        request.file_path,
        request.document_id,
        request.workspace_id,
        request.uploaded_by,
        request.knowledge_base_id,
        request.metadata,
        x_openai_api_key,
        x_gemini_api_key,
    )
    return {"status": "processing_queued", "document_id": request.document_id}


# ─────────────────────────────────────────────────────────────────────────────
# RAGAS Evaluation Endpoint
# ─────────────────────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    question: str
    answer: str
    context_chunks: List[str]


class EvaluateResponse(BaseModel):
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    context_recall: float
    overall: float
    metadata_health: Optional[Dict] = None
    duplicate_health: Optional[Dict] = None


@app.post("/api/v1/evaluate", response_model=EvaluateResponse)
async def evaluate_endpoint(
    request: EvaluateRequest,
    x_openai_api_key: Optional[str] = Header(None),
    x_gemini_api_key: Optional[str] = Header(None),
):
    """
    RAGAS evaluation endpoint.
    Computes Faithfulness, Answer Relevancy, Context Precision, and Context Recall
    for a given question / answer / retrieved-context triple.

    Also runs supplementary structural checks:
    - Metadata validator (detects missing document_id / page_number)
    - Duplicate chunk detector (detects redundant top-k slots)
    """
    logger.info(f"RAGAS evaluation request: question='{request.question[:60]}...'")

    try:
        # Core 4 RAGAS metrics (each makes 1 LLM call via gpt-4o-mini / gemini-flash)
        scores = ragas_evaluator.evaluate(
            question=request.question,
            answer=request.answer,
            context_chunks=request.context_chunks,
            openai_api_key=x_openai_api_key,
            gemini_api_key=x_gemini_api_key,
        )

        # Supplementary structural checks (no LLM calls — pure text analysis)
        dup_health = ragas_evaluator.detect_duplicate_chunks(request.context_chunks)

        return EvaluateResponse(
            faithfulness=scores["faithfulness"],
            answer_relevancy=scores["answer_relevancy"],
            context_precision=scores["context_precision"],
            context_recall=scores["context_recall"],
            overall=scores["overall"],
            metadata_health=None,   # metadata check runs on the Next.js side (has structured chunk dicts)
            duplicate_health=dup_health,
        )
    except Exception as e:
        logger.error(f"RAGAS evaluation error: {e}", exc_info=True)
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": "Evaluation failed", "detail": str(e)}
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )