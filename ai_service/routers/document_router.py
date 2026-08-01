from fastapi import APIRouter, BackgroundTasks, Header
from typing import Optional
from schemas.document import DocumentProcessRequest
from controllers.document_controller import handle_document_process

router = APIRouter()

@router.post("/documents/process")
async def process_document(
    request: DocumentProcessRequest, 
    bg_tasks: BackgroundTasks, 
    x_openai_api_key: Optional[str] = Header(None), 
    x_gemini_api_key: Optional[str] = Header(None)
):
    return await handle_document_process(
        request, bg_tasks, x_openai_api_key, x_gemini_api_key
    )
