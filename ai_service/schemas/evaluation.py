from pydantic import BaseModel
from typing import List, Optional, Dict

class EvaluateRequest(BaseModel):
    question: str
    answer: str
    context_chunks: List[str]

class EvaluateResponse(BaseModel):
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    context_recall: float
    overall: float
    metadata_health: Optional[Dict] = None
    duplicate_health: Optional[Dict] = None
