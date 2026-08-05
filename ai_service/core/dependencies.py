import logging
import os
import httpx
from fastapi import Request, HTTPException
from services.credit_accounting import estimate_prompt_tokens, credits_for_usage
from retrieval.qdrant_client import QdrantVectorStore
from core.config import settings

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

async def require_sufficient_credits(request: Request):
    uses_system_key = request.headers.get("x-uses-system-key", "true").lower() == "true"
    if not uses_system_key:
        return True
        
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing X-User-Id header")
        
    # Read body for estimation
    try:
        body = await request.json()
    except:
        body = {}
        
    query = body.get("query", "")
    history = body.get("history", [])
    model = body.get("model", "gpt-4o")
    messages = history + [{"role": "user", "content": query}]
    
    prompt_tokens = estimate_prompt_tokens(model, messages, [])
    estimated_cost = credits_for_usage(model, prompt_tokens, 50) # Assume 50 completion tokens for estimation
    
    app_url = settings.APP_URL
    secret = settings.INTERNAL_SERVICE_SECRET
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{app_url}/api/internal/wallet/{user_id}", 
                headers={"Authorization": f"Bearer {secret}"},
                timeout=5.0
            )
            if resp.status_code == 401 or resp.status_code == 403:
                logger.error("Unauthorized access to internal wallet API. Check INTERNAL_SERVICE_SECRET.")
                raise HTTPException(status_code=500, detail="AI Service configuration error")
            elif resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Wallet not found")
            elif resp.status_code != 200:
                logger.error(f"Failed to fetch wallet balance: {resp.status_code} {resp.text}")
                raise HTTPException(status_code=500, detail="Failed to verify credit balance")
            
            data = resp.json()
            balance = data.get("balance", 0)
        except httpx.RequestError as e:
            logger.error(f"Failed to reach internal wallet API: {e}")
            # If we can't reach the internal service, assume balance check fails closed
            raise HTTPException(status_code=500, detail="Failed to verify credit balance")

    grace = settings.NEGATIVE_GRACE_CREDITS
    if balance + grace < estimated_cost:
        raise HTTPException(status_code=402, detail={"error": "insufficient_credits", "balance": balance, "required": estimated_cost})
        
    return True
