from fastapi import APIRouter, Header
from typing import Optional
from schemas.evaluation import EvaluateRequest, EvaluateResponse
from controllers.evaluation_controller import handle_evaluate

router = APIRouter()

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_endpoint(
    request: EvaluateRequest,
    x_openai_api_key: Optional[str] = Header(None),
    x_gemini_api_key: Optional[str] = Header(None),
):
    return await handle_evaluate(request, x_openai_api_key, x_gemini_api_key)
