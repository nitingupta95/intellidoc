"""
CRAG Evaluator — set-level, synthesis-aware relevance judgment.

Architecture (Phase 1 rewrite):
  OLD: 5 parallel per-chunk LLM calls → scalar score per chunk → aggregate
  NEW: 1 single LLM call with all chunks → structured SetEvalResult →
       hybrid blended score (retrieval + topic_relevance + synthesis_bonus)

The evaluator returns three fields per query:
  - topic_relevance: 0.0–1.0 (is the query even about what's in the doc?)
  - answerability:   DIRECT | SYNTHESIZABLE | INSUFFICIENT
  - reasoning:       short string (for logging/debugging only)

Feature flag: CRAG_SYNTHESIS_ENABLED (core/config.py)
  - True  → use set-level synthesis-aware evaluation (default)
  - False → fall back to old per-chunk exact-match scoring
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from core.config import settings
from .models import (
    DocEvalScore,
    SetEvalResult,
    Answerability,
    EvalVerdict,
    EvalResult,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Meta-query bypass keywords (unchanged from original)
# ─────────────────────────────────────────────────────────────────────────────

_META_KEYWORDS = [
    "summarize", "summarise", "summary", "overview", "summrsie", "sumarize",
    "question", "questions", "quiz", "key point", "main idea",
    "explain this", "what is this document",
]


def _is_meta_query(question: str) -> bool:
    q = question.lower()
    return any(kw in q for kw in _META_KEYWORDS) or (len(q) < 15 and "doc" in q)


# ─────────────────────────────────────────────────────────────────────────────
# LLM helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_llm(openai_api_key: str = None, gemini_api_key: str = None):
    """Return a zero-temperature LLM for evaluation."""
    if openai_api_key:
        return ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=openai_api_key)
    if gemini_api_key:
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, google_api_key=gemini_api_key)
    return ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=settings.OPENAI_API_KEY)


def _parse_json_safe(raw: str) -> dict:
    """Strip markdown fences and parse JSON; return empty dict on failure."""
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned.strip())
    except Exception:
        # Fallback: try to extract a JSON object from the string
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception as e:
                logger.error(f"Fallback JSON parsing failed: {e}. Raw text was: {raw}")
                return {}
        logger.error(f"JSON parsing failed. Raw text was: {raw}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Set-level evaluator prompt (Phase 1 — written in full)
# ─────────────────────────────────────────────────────────────────────────────

_SET_EVAL_SYSTEM = """\
You are an expert retrieval evaluator for a Retrieval-Augmented Generation (RAG) system.
You receive a user question and the COMPLETE SET of retrieved document chunks.
Your job is to judge whether the set as a whole can support an answer — NOT whether any
single chunk contains a verbatim answer. RAG is designed to combine information across chunks.

Return ONLY valid JSON (no markdown, no extra text) with exactly three fields:

{
  "topic_relevance": <float 0.0–1.0>,
  "answerability": "<DIRECT|SYNTHESIZABLE|INSUFFICIENT>",
  "reasoning": "<1–2 sentences>"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. topic_relevance (float 0.0–1.0)
   How relevant are these chunks to the domain/topic of the question?
   1.0 = chunks are directly about the topic of the question
   0.5 = chunks are loosely related (same broad domain, different sub-topic)
   0.0 = chunks are completely unrelated to the question's subject matter

   Calibration examples:
   - Chunks about "vertical scaling" + question about "scaling strategies" → 1.0
   - Chunks about "scaling" + question about "Python syntax" → 0.0
   - Chunks about "database scaling" + question about "best database vendor" → 0.3–0.4
     (scaling patterns are on-topic but vendor recommendations are absent)

   CRITICAL: If topic_relevance < 0.2, you MUST set answerability = "INSUFFICIENT"
   (the chunks are simply off-topic; do not waste reasoning on synthesis).

2. answerability (enum: "DIRECT" | "SYNTHESIZABLE" | "INSUFFICIENT")

   DIRECT:
     At least one chunk contains the answer as an explicitly stated fact.
     Example: question = "what is vertical scaling?" and a chunk defines it verbatim.

   SYNTHESIZABLE:
     No single chunk states the answer, BUT the set contains enough on-topic facts
     that a faithful, non-hallucinated answer CAN be composed by combining information
     across chunks. Use SYNTHESIZABLE when:
     • The question asks for a COMPARISON and the chunks describe both sides separately.
     • The question asks for IMPLICATIONS and the chunks describe the causes.
     • The question asks for TRADE-OFFS and the chunks describe the properties of each option.
     • The question asks for a RECOMMENDATION and the chunks give enough facts to reason from.
     Example: question = "which is better, vertical or horizontal scaling?"
              chunk A describes vertical scaling's ceiling, chunk B describes horizontal
              scaling's mechanism → SYNTHESIZABLE (the comparison is a valid synthesis).

   INSUFFICIENT:
     Use INSUFFICIENT when:
     (a) topic_relevance < 0.2 (off-topic chunks), OR
     (b) The chunks are on-topic but genuinely do not contain the required facts.
         The answer would require facts that are simply absent from the chunks.
     Example: question = "which specific database vendor should I use?"
              chunks describe generic scaling patterns without naming any vendors
              → INSUFFICIENT (vendor names are absent; synthesis cannot add them).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES — READ CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Do NOT return INSUFFICIENT merely because no single chunk has a verbatim answer.
  Synthesis is the point of RAG — multiple chunks together can legitimately answer.
- Do NOT return SYNTHESIZABLE if the required facts are simply absent from all chunks.
  Synthesis can only combine facts that ARE in the chunks, not invent new ones.
- Exact-trivia questions ("what is 2+2", "who is the president") against domain documents
  → topic_relevance = 0.0, answerability = "INSUFFICIENT".
- A mix of one strong and several weak chunks → judge on the BEST chunks in the set,
  not the average. If the strong chunk(s) can anchor an answer, that counts.
"""

_SET_EVAL_HUMAN = """\
Question: {question}

Retrieved Chunks (evaluate the set as a whole):
{chunks_text}
"""

_set_eval_prompt = ChatPromptTemplate.from_messages([
    ("system", _SET_EVAL_SYSTEM),
    ("human", _SET_EVAL_HUMAN),
])


async def _run_set_level_eval(
    question: str,
    citations: List[Dict[str, Any]],
    openai_api_key: str = None,
    gemini_api_key: str = None,
) -> SetEvalResult:
    """
    Single LLM call that evaluates the entire retrieved set at once.
    Returns a SetEvalResult with topic_relevance, answerability, reasoning.
    """
    # Format chunks for the prompt
    chunks_text = "\n\n---\n\n".join(
        f"[Chunk {i+1}]\n{cit.get('full_text', cit.get('text_snippet', ''))}"
        for i, cit in enumerate(citations)
    )

    llm = _get_llm(openai_api_key, gemini_api_key)
    chain = _set_eval_prompt | llm | StrOutputParser()

    try:
        raw = await chain.ainvoke({"question": question, "chunks_text": chunks_text})
        data = _parse_json_safe(raw)

        topic_relevance = float(data.get("topic_relevance", 0.0))
        topic_relevance = max(0.0, min(1.0, topic_relevance))  # clamp

        raw_answerability = data.get("answerability", "INSUFFICIENT").upper()
        # Enforce: low topic_relevance → INSUFFICIENT regardless of LLM output
        if topic_relevance < 0.2:
            answerability = Answerability.INSUFFICIENT
        else:
            try:
                answerability = Answerability(raw_answerability)
            except ValueError:
                answerability = Answerability.INSUFFICIENT

        reasoning = data.get("reasoning", "")
        return SetEvalResult(
            topic_relevance=topic_relevance,
            answerability=answerability,
            reasoning=reasoning,
        )
    except Exception as e:
        logger.warning(f"Set-level CRAG eval failed: {e}; defaulting to INSUFFICIENT")
        return SetEvalResult(
            topic_relevance=0.0,
            answerability=Answerability.INSUFFICIENT,
            reasoning=f"Evaluation error: {e}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Legacy per-chunk evaluator (used when CRAG_SYNTHESIS_ENABLED=False)
# ─────────────────────────────────────────────────────────────────────────────

_LEGACY_CHUNK_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are a strict retrieval evaluator for RAG. You will be given ONE retrieved chunk and a question. Return a relevance score in [0.0, 1.0]. 1.0 = chunk alone is sufficient to answer fully/mostly. 0.0 = chunk is irrelevant or only mentions the topic without answering the question. Be extremely conservative with high scores; if the question asks for a definition and the chunk only mentions applying for it, the score MUST be 0.0. EXCEPTION: If the question asks for a general summary, overview, or explanation of the entire document, consider the chunk highly relevant (score 1.0) as long as it contains valid content from the document. Also return a short reason. Output JSON only."),
    ("human", "Question: {question}\n\nChunk:\n{chunk}")
])


def _get_legacy_eval_chain(openai_api_key: str = None, gemini_api_key: str = None):
    llm = _get_llm(openai_api_key, gemini_api_key)
    return _LEGACY_CHUNK_PROMPT | llm.with_structured_output(DocEvalScore)


async def _score_single_doc(chain, question: str, citation: Dict[str, Any]) -> DocEvalScore:
    chunk_text = citation.get("full_text", "")
    try:
        return await chain.ainvoke({"question": question, "chunk": chunk_text})
    except Exception as e:
        return DocEvalScore(score=0.0, reason=f"Evaluation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Blended confidence score (Phase 2)
# ─────────────────────────────────────────────────────────────────────────────

def _compute_blended_score(
    citations: List[Dict[str, Any]],
    topic_relevance: float,
    answerability: Answerability,
) -> float:
    """
    Blended score = retrieval_weight * avg_qdrant_score
                  + llm_topic_weight * topic_relevance
                  + synthesis_bonus  (if SYNTHESIZABLE)

    All three components are configurable via Settings (core/config.py).
    """
    # Average of Qdrant retrieval scores (already normalised to 0–1 by cosine)
    retrieval_scores = [
        float(c.get("score", 0.0)) for c in citations
        if c.get("score") is not None
    ]
    avg_retrieval = sum(retrieval_scores) / len(retrieval_scores) if retrieval_scores else 0.0

    synthesis_bonus = (
        settings.CRAG_SYNTHESIS_BONUS
        if answerability == Answerability.SYNTHESIZABLE
        else 0.0
    )

    blended = (
        settings.CRAG_RETRIEVAL_WEIGHT * avg_retrieval
        + settings.CRAG_LLM_TOPIC_WEIGHT * topic_relevance
        + synthesis_bonus
    )
    return round(min(1.0, blended), 4)


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_documents(
    question: str,
    citations: List[Dict[str, Any]],
    openai_api_key: str = None,
    gemini_api_key: str = None,
) -> EvalResult:
    """
    Evaluates retrieved documents against a question and returns a verdict.

    When CRAG_SYNTHESIS_ENABLED=True (default):
      - Single set-level LLM call → topic_relevance + answerability
      - Hybrid blended score (retrieval + LLM topic + synthesis bonus)
      - Structured log of score breakdown for every query

    When CRAG_SYNTHESIS_ENABLED=False:
      - Legacy per-chunk parallel scoring (old behavior, exact-match only)
    """
    if not citations:
        return EvalResult(
            verdict=EvalVerdict.INCORRECT,
            good_docs=[],
            all_scores=[],
            reason="No documents were retrieved.",
            topic_relevance=0.0,
            answerability=Answerability.INSUFFICIENT,
            reasoning="No documents were retrieved.",
            blended_score=0.0,
        )

    # ── Meta-query bypass (unchanged) ─────────────────────────────────────────
    if _is_meta_query(question):
        return EvalResult(
            verdict=EvalVerdict.CORRECT,
            good_docs=citations,
            all_scores=[1.0] * len(citations),
            reason="Summarization/general query detected; bypassing strict relevance filtering.",
            topic_relevance=1.0,
            answerability=Answerability.DIRECT,
            reasoning="Meta-query bypass.",
            blended_score=1.0,
        )

    # ── Synthesis-aware path (Phase 1+2) ──────────────────────────────────────
    if settings.CRAG_SYNTHESIS_ENABLED:
        set_eval = await _run_set_level_eval(question, citations, openai_api_key, gemini_api_key)

        blended = _compute_blended_score(citations, set_eval.topic_relevance, set_eval.answerability)

        # All citations with non-null score are "good_docs" when we proceed
        good_docs = [c for c in citations if c.get("score") is not None]
        all_scores = [float(c.get("score", 0.0)) for c in citations]

        # Verdict routing
        if blended >= settings.CRAG_UPPER_THRESHOLD:
            verdict = EvalVerdict.CORRECT
            reason = (
                f"Blended confidence {blended:.3f} ≥ upper threshold {settings.CRAG_UPPER_THRESHOLD}. "
                f"Answerability: {set_eval.answerability.value}. "
                f"Topic relevance: {set_eval.topic_relevance:.2f}."
            )
        elif blended < settings.CRAG_LOWER_THRESHOLD:
            verdict = EvalVerdict.INCORRECT
            good_docs = []
            reason = (
                f"Blended confidence {blended:.3f} < lower threshold {settings.CRAG_LOWER_THRESHOLD}. "
                f"Topic relevance too low ({set_eval.topic_relevance:.2f}) or chunks insufficient."
            )
        else:
            # AMBIGUOUS band — check if the answerability tells us it's INSUFFICIENT
            if set_eval.answerability == Answerability.INSUFFICIENT:
                verdict = EvalVerdict.INCORRECT
                good_docs = []
                reason = (
                    f"Chunks are on-topic (relevance={set_eval.topic_relevance:.2f}) but INSUFFICIENT "
                    f"to answer the question. Web search recommended."
                )
            else:
                # SYNTHESIZABLE or DIRECT but blended is in the ambiguous band
                verdict = EvalVerdict.AMBIGUOUS
                reason = (
                    f"Blended confidence {blended:.3f} is in the ambiguous band. "
                    f"Answerability: {set_eval.answerability.value}. "
                    f"May attempt best-effort synthesis."
                )

        # ── Mandatory structured log (Phase 2 requirement) ────────────────────
        import hashlib
        q_hash = hashlib.sha256(question.encode()).hexdigest()[:12]
        avg_retrieval = (
            sum(float(c.get("score", 0.0)) for c in citations) / len(citations)
            if citations else 0.0
        )
        logger.info(
            "CRAG score breakdown: %s",
            {
                "event":             "crag_score_breakdown",
                "query_hash":        q_hash,
                "avg_retrieval_score": round(avg_retrieval, 4),
                "topic_relevance":   round(set_eval.topic_relevance, 4),
                "answerability":     set_eval.answerability.value,
                "blended_score":     blended,
                "verdict":           verdict.value,
                "reasoning":         set_eval.reasoning,
            }
        )

        return EvalResult(
            verdict=verdict,
            good_docs=good_docs,
            all_scores=all_scores,
            reason=reason,
            topic_relevance=set_eval.topic_relevance,
            answerability=set_eval.answerability,
            reasoning=set_eval.reasoning,
            blended_score=blended,
        )

    # ── Legacy per-chunk path (CRAG_SYNTHESIS_ENABLED=False) ─────────────────
    chain = _get_legacy_eval_chain(openai_api_key, gemini_api_key)
    tasks = [_score_single_doc(chain, question, cit) for cit in citations]
    scores: List[DocEvalScore] = await asyncio.gather(*tasks)

    all_scores = [s.score for s in scores]
    good_docs = [
        cit for cit, s in zip(citations, scores)
        if s.score > settings.CRAG_LOWER_THRESHOLD
    ]

    if any(s > settings.CRAG_UPPER_THRESHOLD for s in all_scores):
        verdict = EvalVerdict.CORRECT
        reason = f"{len(good_docs)} of {len(citations)} chunks above lower threshold; at least one high confidence."
    elif all(s < settings.CRAG_LOWER_THRESHOLD for s in all_scores):
        verdict = EvalVerdict.INCORRECT
        good_docs = []
        reason = "No documents met the relevance threshold."
    else:
        verdict = EvalVerdict.AMBIGUOUS
        reason = f"{len(good_docs)} of {len(citations)} chunks had partial relevance."

    return EvalResult(
        verdict=verdict,
        good_docs=good_docs,
        all_scores=all_scores,
        reason=reason,
        topic_relevance=0.0,
        answerability=Answerability.INSUFFICIENT,
        reasoning="Legacy eval mode.",
        blended_score=0.0,
    )
