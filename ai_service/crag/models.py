from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DocEvalScore(BaseModel):
    score: float
    reason: str

class EvalVerdict(str, Enum):
    CORRECT = "CORRECT"
    AMBIGUOUS = "AMBIGUOUS"
    INCORRECT = "INCORRECT"

class EvalResult(BaseModel):
    verdict: EvalVerdict
    good_docs: List[Dict[str, Any]]
    all_scores: List[float]
    reason: str

class WebQuery(BaseModel):
    query: str

class PendingCRAGContext(BaseModel):
    pending_id: str
    query: str
    verdict: str
    good_docs: List[Dict[str, Any]]
    workspace_id: str
    knowledge_base_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    history: List[Dict[str, Any]]
    created_at: float
