from fastapi import APIRouter, BackgroundTasks, Header, Depends, Request
from typing import Optional
from schemas.chat import ChatRequest, ResolveRequest
from controllers.chat_controller import handle_chat_query, handle_chat_resolve
from services.auth_service import authenticate
from core.dependencies import get_redis_client

router = APIRouter(tags=["Chat"])

@router.post("/chat")
async def chat_endpoint(
    request: Request,
    chat_req: ChatRequest, 
    bg_tasks: BackgroundTasks,
    x_openai_api_key: Optional[str] = Header(None), 
    x_gemini_api_key: Optional[str] = Header(None),
    user: dict = Depends(authenticate)
):
    redis_client = get_redis_client(request)
    return await handle_chat_query(
        chat_req, bg_tasks, redis_client, x_openai_api_key, x_gemini_api_key, user
    )

@router.post("/chat/resolve")
async def resolve_chat_endpoint(
    request: Request,
    resolve_req: ResolveRequest, 
    bg_tasks: BackgroundTasks,
    x_openai_api_key: Optional[str] = Header(None),
    x_gemini_api_key: Optional[str] = Header(None),
    user: dict = Depends(authenticate)
):
    redis_client = get_redis_client(request)
    return await handle_chat_resolve(
        resolve_req, bg_tasks, redis_client, x_openai_api_key, x_gemini_api_key, user
    )
