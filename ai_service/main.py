import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException
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
from graph.neo4j_client import neo4j_client
from graph.extractor import extract_graph_from_document
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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
parser = DocumentParser()
chunker = SemanticChunker()
embedding_svc = EmbeddingService()
vector_store = QdrantVectorStore()
rag_chain = RAGChain()

class ChatRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    knowledge_base_id: Optional[str] = None
    history: Optional[List[dict]] = None

class DocumentProcessRequest(BaseModel):
    document_id: str
    file_path: str
    metadata: dict = {}

consumer_task = None

@app.on_event("startup")
async def startup_event():
    global consumer_task
    logger.info("Starting RabbitMQ Consumer...")
    consumer_task = asyncio.create_task(consume())
    neo4j_client.init_graph_schema()

@app.on_event("shutdown")
def shutdown_event():
    neo4j_client.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

@app.post("/api/v1/chat")
async def chat_endpoint(request: ChatRequest):
    """
    RAG chat endpoint using SSE streaming.
    """
    logger.info(f"Received chat query: {request.query}")
    
    # 1. Embed query
    query_vector = embedding_svc.embed_query(request.query)
    
    # 2. Retrieve from Vector DB (Qdrant)
    search_results = vector_store.search(
        query_vector=query_vector, 
        limit=5, 
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
        
        async for chunk in rag_chain.stream_answer(request.query, retrieved_docs, request.history):
            # Format as Server-Sent Events (SSE)
            yield f"data: {chunk}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(response_generator(), media_type="text/event-stream")

class RetrieveRequest(BaseModel):
    query: str
    document_ids: list[str]
    limit: int = 5

@app.post("/api/v1/retrieve")
async def retrieve_endpoint(request: RetrieveRequest):
    """
    Endpoint for Next.js to retrieve chunks from Qdrant.
    """
    logger.info(f"Retrieving chunks for query: {request.query}")
    
    # Embed query
    query_vector = embedding_svc.embed_query(request.query)
    
    # Retrieve from Qdrant with filter
    search_results = vector_store.search(
        query_vector=query_vector, 
        limit=request.limit, 
        document_ids=request.document_ids
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
        # We assume Next.js is running on port 3000
        url = f"http://localhost:3000/api/documents/{document_id}"
        with httpx.Client(timeout=5.0) as client:
            client.patch(url, json=data)
    except Exception as e:
        logger.error(f"Failed to update document status in Next.js: {e}")

def process_document_pipeline(file_path: str, document_id: str, metadata: dict):
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
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            s3.download_file(settings.S3_BUCKET, file_path, tmp_file.name)
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
        embeddings = embedding_svc.embed_documents(texts)
        
        # 4. Upsert to Qdrant
        update_document_status(document_id, {"currentStep": "Saving to Vector Store", "progress": 90})
        vector_store.upsert_chunks(chunks, embeddings)
        logger.info(f"Upserted {len(chunks)} vectors to Qdrant for {document_id}")
        
        # 5. Extract Entities (LLM Graph Extraction)
        # Using a new event loop since this is a synchronous background task in a threadpool
        user_id = metadata.get("userId", "system")
        chunks_for_graph = [{"text": c["content"], "chunk_idx": i} for i, c in enumerate(chunks)]
        asyncio.run(extract_graph_from_document(document_id, user_id, chunks_for_graph))
        
        # Success!
        update_document_status(document_id, {
            "status": "INDEXED", 
            "currentStep": "Complete", 
            "progress": 100,
            "chunkCount": len(chunks),
            "embeddingModel": "all-MiniLM-L6-v2"
        })
        
    except Exception as e:
        logger.error(f"Pipeline failed for {document_id}: {e}")
        update_document_status(document_id, {
            "status": "ERROR", 
            "errorMessage": str(e)
        })

@app.post("/api/v1/documents/process")
async def process_document(request: DocumentProcessRequest, bg_tasks: BackgroundTasks):
    """
    Triggers the document processing pipeline asynchronously.
    """
    logger.info(f"Queuing document processing: {request.document_id}")
    bg_tasks.add_task(
        process_document_pipeline, 
        request.file_path, 
        request.document_id, 
        request.metadata
    )
    return {"status": "processing_queued", "document_id": request.document_id}

@app.get("/api/v1/graph")
async def get_graph(userId: str, docId: str = None, type: str = None, limit: int = 200):
    try:
        doc_filter = "AND ANY(d IN e.docIds WHERE d IN $docIds)" if docId else ""
        type_filter = "AND e.type IN $types" if type else ""
        
        docIds = [docId] if docId else []
        types = [type] if type else []

        nodes_query = f"""
        MATCH (e:Entity)
        WHERE e.userId = $userId {doc_filter} {type_filter}
        RETURN e.id AS id, e.name AS name, e.type AS type, e.docIds AS docIds, 
               e.userId AS userId, e.frequency AS frequency, e.description AS description
        ORDER BY e.frequency DESC
        LIMIT toInteger($limit)
        """
        nodes = neo4j_client.run_query(nodes_query, {"userId": userId, "docIds": docIds, "types": types, "limit": limit})
        
        if not nodes:
            return {"nodes": [], "edges": [], "stats": {"nodeCount": 0, "edgeCount": 0, "docCount": 0, "clusterCount": 0}}
            
        node_ids = [n["id"] for n in nodes]
        
        edges_query = """
        MATCH (a:Entity)-[r:RELATES]->(b:Entity)
        WHERE a.userId = $userId AND b.userId = $userId
          AND a.id IN $nodeIds AND b.id IN $nodeIds
        RETURN elementId(r) AS id, a.id AS source, b.id AS target,
               r.type AS type, r.weight AS weight, r.docIds AS docIds, r.context AS context
        ORDER BY r.weight DESC
        LIMIT 1000
        """
        edges = neo4j_client.run_query(edges_query, {"userId": userId, "nodeIds": node_ids})
        
        all_doc_ids = set()
        all_types = set()
        for n in nodes:
            all_doc_ids.update(n.get("docIds", []))
            all_types.add(n.get("type"))
            
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "nodeCount": len(nodes),
                "edgeCount": len(edges),
                "docCount": len(all_doc_ids),
                "clusterCount": len(all_types)
            }
        }
    except Exception as e:
        logger.error(f"Graph query error: {e}")
        return {"nodes": [], "edges": [], "stats": {"nodeCount": 0, "edgeCount": 0, "docCount": 0, "clusterCount": 0}}

@app.get("/api/v1/graph/search")
async def search_graph(userId: str, q: str, limit: int = 20):
    if not q or len(q) < 2:
        return {"nodes": []}
        
    query = """
    CALL db.index.fulltext.queryNodes("entity_search", $query + "*")
    YIELD node AS e, score
    WHERE e.userId = $userId
    RETURN e.id AS id, e.name AS name, e.type AS type,
           e.docIds AS docIds, e.frequency AS frequency,
           e.description AS description, score
    ORDER BY score DESC
    LIMIT $limit
    """
    nodes = neo4j_client.run_query(query, {"userId": userId, "query": q, "limit": limit})
    return {"nodes": nodes}

@app.get("/api/v1/graph/export")
async def export_graph(userId: str, format: str = "json"):
    data = await get_graph(userId=userId, limit=1000)
    
    if format == "json":
        return data
        
    if format == "csv":
        from fastapi.responses import PlainTextResponse
        csv = ["id,name,type,frequency,description"]
        for n in data["nodes"]:
            name = str(n.get("name", "")).replace('"', '""')
            desc = str(n.get("description", "")).replace('"', '""')
            csv.append(f'"{n["id"]}","{name}","{n.get("type", "")}",{n.get("frequency", 0)},"{desc}"')
        
        return PlainTextResponse(
            "\n".join(csv),
            headers={"Content-Disposition": f'attachment; filename="intellidoc-graph.csv"'}
        )
    
    raise HTTPException(status_code=400, detail="Invalid format. Use json or csv.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
