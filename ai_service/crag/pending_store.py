import json
import uuid
import time
from typing import Optional
from core.config import settings
from .models import PendingCRAGContext

async def save_pending_context(redis_client, ctx: PendingCRAGContext) -> str:
    key = f"crag_pending:{ctx.pending_id}"
    await redis_client.setex(key, settings.CRAG_PENDING_TTL_SECONDS, ctx.model_dump_json())
    return ctx.pending_id

async def load_pending_context(redis_client, pending_id: str) -> Optional[PendingCRAGContext]:
    key = f"crag_pending:{pending_id}"
    data = await redis_client.get(key)
    if not data:
        return None
    await redis_client.delete(key)
    return PendingCRAGContext.model_validate_json(data)
