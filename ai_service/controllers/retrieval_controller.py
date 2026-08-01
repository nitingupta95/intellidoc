import logging
from schemas.retrieval import RetrieveRequest
from embeddings.embedding_service import EmbeddingService
from core.dependencies import get_vector_store

logger = logging.getLogger(__name__)
embedding_svc = EmbeddingService()

async def handle_retrieve(
    request: RetrieveRequest, 
    x_openai_api_key: str, 
    x_gemini_api_key: str
):
    logger.info(f"Retrieving chunks for query: {request.query}")
    
    query_vector, provider, dim = embedding_svc.embed_query(
        request.query, 
        openai_api_key=x_openai_api_key,
        gemini_api_key=x_gemini_api_key
    )
    
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
