from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Legacy per-chunk scoring model (kept for backward compatibility)
# ─────────────────────────────────────────────────────────────────────────────

class DocEvalScore(BaseModel):
    score: float
    reason: str


# ─────────────────────────────────────────────────────────────────────────────
# New set-level evaluation models (Phase 1 — synthesis-aware CRAG)
# ─────────────────────────────────────────────────────────────────────────────

class Answerability(str, Enum):
    """
    DIRECT        — At least one chunk contains the answer as a stated fact.
    SYNTHESIZABLE — No single chunk states the answer, but the set contains enough
                    on-topic facts that a faithful, non-hallucinated answer can be
                    composed by combining information across chunks.
    INSUFFICIENT  — The chunks are either off-topic or genuinely do not contain
                    enough information to answer without external knowledge.
    """
    DIRECT        = "DIRECT"
    SYNTHESIZABLE = "SYNTHESIZABLE"
    INSUFFICIENT  = "INSUFFICIENT"


class SetEvalResult(BaseModel):
    """
    Structured output from the set-level CRAG evaluator LLM call.
    Replaces the old per-chunk scalar score.
    """
    topic_relevance: float      # 0.0–1.0: is the query about what's in these chunks?
    answerability:   Answerability
    reasoning:       str        # 1–2 sentences for logging only, not shown to users


# ─────────────────────────────────────────────────────────────────────────────
# Core verdict + result models
# ─────────────────────────────────────────────────────────────────────────────

class EvalVerdict(str, Enum):
    CORRECT   = "CORRECT"
    AMBIGUOUS = "AMBIGUOUS"
    INCORRECT = "INCORRECT"


class EvalResult(BaseModel):
    verdict:    EvalVerdict
    good_docs:  List[Dict[str, Any]]
    all_scores: List[float]
    reason:     str

    # ── Phase 1 additions (optional to preserve backward compat with old code paths) ──
    topic_relevance: float           = 0.0
    answerability:   Answerability   = Answerability.INSUFFICIENT
    reasoning:       str             = ""
    blended_score:   float           = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Web search / pending context models (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

class WebQuery(BaseModel):
    query: str


class PendingCRAGContext(BaseModel):
    pending_id:        str
    query:             str
    verdict:           str
    good_docs:         List[Dict[str, Any]]
    workspace_id:      str
    knowledge_base_id: Optional[str] = None
    document_ids:      Optional[List[str]] = None
    history:           List[Dict[str, Any]]
    created_at:        float
    # Phase 1 addition: carry answerability through the pending context
    answerability:     str = Answerability.INSUFFICIENT
    document_summaries: Optional[Dict[str, str]] = None
