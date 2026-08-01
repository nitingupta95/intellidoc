import logging
from retrieval.qdrant_client import QdrantVectorStore

logger = logging.getLogger(__name__)

async def get_vector_store(request=None, provider: str = "openai", dimension: int = 1536):
    """
    Get or create QdrantVectorStore globally.
    We don't strictly need Request if we cache it globally, but for clean FastAPI:
    we can store it on a global dict or request.app.state.
    We will use a global dict here for simplicity outside of request context.
    """
    global _vector_stores
    if "_vector_stores" not in globals():
        global _vector_stores
        _vector_stores = {}
        
    key = f"{provider}_{dimension}"
    if key not in _vector_stores:
        collection_name = f"documents_{provider}"
        logger.info(f"Initializing Vector Store for {collection_name} (dim {dimension})...")
        vs = QdrantVectorStore(collection_name=collection_name, dimension=dimension)
        await vs._ensure_collection()
        _vector_stores[key] = vs
    return _vector_stores[key]

def get_redis_client(request):
    return request.app.state.redis
