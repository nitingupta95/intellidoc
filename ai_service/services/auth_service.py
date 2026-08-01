import json
from typing import Optional
from fastapi import Header, Request

async def authenticate(request: Request, authorization: Optional[str] = Header(None)):
    """Mock authentication dependency that checks a Redis auth cache."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"user_id": "test_user", "role": "user"}
    
    token = authorization.split(" ")[1]
    redis_client = request.app.state.redis
    cache_key = f"auth:{token}"
    
    cached_user = await redis_client.get(cache_key)
    if cached_user:
        return json.loads(cached_user)
    
    user = {"user_id": "decoded_user_123", "role": "user"}
    await redis_client.setex(cache_key, 300, json.dumps(user))
    return user
