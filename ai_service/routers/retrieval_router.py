from fastapi import APIRouter, Header
from typing import Optional
from schemas.retrieval import RetrieveRequest
from controllers.retrieval_controller import handle_retrieve

router = APIRouter()

@router.post("/retrieve")
async def retrieve_endpoint(
    request: RetrieveRequest, 
    x_openai_api_key: Optional[str] = Header(None), 
    x_gemini_api_key: Optional[str] = Header(None)
):
    return await handle_retrieve(request, x_openai_api_key, x_gemini_api_key)
