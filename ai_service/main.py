import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import asyncio

from core.config import settings
from parsers.document_parser import DocumentParser
from embeddings.semantic_chunker import SemanticChunker
from embeddings.embedding_service import EmbeddingService
from retrieval.qdrant_client import QdrantVectorStore
from llm.rag_chain import RAGChain
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

# Initialize Services
parser = DocumentParser()
chunker = SemanticChunker()
embedding_svc = EmbeddingService()
vector_stores = {}
rag_chain = RAGChain()

def get_vector_store(provider: str = "openai", dimension: int = 1536):
    global vector_stores
    key = f"{provider}_{dimension}"
    if key not in vector_stores:
        collection_name = f"documents_{provider}"
        logger.info(f"Initializing Vector Store for {collection_name} (dim {dimension})...")
        vector_stores[key] = QdrantVectorStore(collection_name=collection_name, dimension=dimension)
    return vector_stores[key]

class ChatRequest(BaseModel):
    query: str
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    history: Optional[List[dict]] = None

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
    logger.info("Starting RabbitMQ Consumer...")
    consumer_task = asyncio.create_task(consume())

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

@app.post("/api/v1/chat")
async def chat_endpoint(request: ChatRequest, x_openai_api_key: Optional[str] = Header(None), x_gemini_api_key: Optional[str] = Header(None)):
    """
    RAG chat endpoint using SSE streaming.
    """
    logger.info(f"Received chat query: {request.query}")
    
    try:
        # 1. Embed query
        query_vector, provider, dim = embedding_svc.embed_query(
            request.query, 
            openai_api_key=x_openai_api_key, 
            gemini_api_key=x_gemini_api_key
        )
        
        # 2. Retrieve from Vector DB (Qdrant)
        vs = get_vector_store(provider=provider, dimension=dim)
        search_results = vs.search(
            query_vector=query_vector, 
            limit=5, 
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            document_ids=request.document_ids
        )
        
        # Extract text from payloads
        retrieved_docs = []
        citations = []
        for res in search_results:
            payload = res.payload or {}
            text = payload.get("content", "")
            retrieved_docs.append(text)
            citations.append({
                "score": res.score,
                "text_snippet": text[:100] + "...",
                "metadata": payload.get("metadata", {})
            })
            
        if not retrieved_docs:
            retrieved_docs = ["No relevant context found in documents."]

        # 3. Stream LLM Response via LangChain
        async def response_generator():
            # Yield citations first as a metadata event
            yield f"data: {{\"event\": \"citations\", \"data\": {citations}}}\n\n"
            
            async for chunk in rag_chain.stream_answer(
                request.query, 
                retrieved_docs, 
                request.history, 
                openai_api_key=x_openai_api_key,
                gemini_api_key=x_gemini_api_key
            ):
                # Format as Server-Sent Events (SSE)
                yield f"data: {chunk}\n\n"
                
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
    vs = get_vector_store(provider=provider, dimension=dim)
    search_results = vs.search(
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

def update_document_status(document_id: str, data: dict):
    try:
        # Use ALLOWED_ORIGIN from environment variables (which points to the frontend URL)
        frontend_url = settings.ALLOWED_ORIGIN.rstrip("/")
        url = f"{frontend_url}/api/documents/{document_id}"
        with httpx.Client(timeout=5.0) as client:
            client.patch(url, json=data)
    except Exception as e:
        logger.error(f"Failed to update document status in Next.js: {e}")

def process_document_pipeline(file_path: str, document_id: str, workspace_id: str, uploaded_by: str, knowledge_base_id: Optional[str], metadata: dict, openai_api_key: str = None, gemini_api_key: str = None):
    """Background task for parsing, chunking, and embedding."""
    try:
        update_document_status(document_id, {"status": "PROCESSING", "currentStep": "Downloading from MinIO", "progress": 10})
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
        update_document_status(document_id, {"currentStep": "Parsing Document", "progress": 30})
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
        update_document_status(document_id, {"currentStep": "Chunking text", "progress": 50})
        chunks = chunker.chunk_documents(elements)
        logger.info(f"Created {len(chunks)} chunks for {document_id}")
        
        if not chunks:
            logger.warning(f"No text chunks could be extracted from {file_path}. It might be an image-only PDF.")
            update_document_status(document_id, {
                "status": "INDEXED", 
                "progress": 100,
                "currentStep": "Completed with warnings: No text found"
            })
            return
            
        # 3. Embed
        update_document_status(document_id, {"currentStep": "Generating Embeddings", "progress": 70})
        texts = [c["content"] for c in chunks]
        embeddings, provider, dim = embedding_svc.embed_documents(
            texts, 
            openai_api_key=openai_api_key, 
            gemini_api_key=gemini_api_key
        )
        
        # 4. Upsert to Qdrant
        update_document_status(document_id, {"currentStep": "Saving to Vector Store", "progress": 90})
        vs = get_vector_store(provider=provider, dimension=dim)
        vs.upsert_chunks(chunks, embeddings)
        logger.info(f"Upserted {len(chunks)} vectors to Qdrant for {document_id}")
        
        # Success!
        update_document_status(document_id, {
            "status": "INDEXED", 
            "currentStep": "Complete", 
            "progress": 100,
            "chunkCount": len(chunks),
            "embeddingModel": f"provider: {provider}, dim: {dim}"
        })
        
    except Exception as e:
        logger.error(f"Pipeline failed for {document_id}: {e}")
        update_document_status(document_id, {
            "status": "ERROR", 
            "errorMessage": str(e)
        })

@app.post("/api/v1/documents/process")
async def process_document(request: DocumentProcessRequest, bg_tasks: BackgroundTasks, x_openai_api_key: Optional[str] = Header(None), x_gemini_api_key: Optional[str] = Header(None)):
    """
    Triggers the document processing pipeline asynchronously.
    """
    logger.info(f"Queuing document processing: {request.document_id}")
    bg_tasks.add_task(
        process_document_pipeline, 
        request.file_path, 
        request.document_id, 
        request.workspace_id,
        request.uploaded_by,
        request.knowledge_base_id,
        request.metadata,
        x_openai_api_key,
        x_gemini_api_key
    )
    return {"status": "processing_queued", "document_id": request.document_id}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )