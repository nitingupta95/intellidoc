"""
Multi-hop retrieval engine (feat/mult-hop-retrival).

Architecture
────────────
Hop 1  = existing Phase-0 retrieval (vector search → reranker) run with the
          raw user query.  CRAG grading is applied to the hop-1 chunks.

After each hop the *hop-sufficiency judge* makes a single LLM call:

    Input : {originalQuery, chunksRetrievedSoFar}
    Output: {done: true}
             OR
            {done: false, missingFact: "<what is still needed>",
             nextQuery: "<exact entity/keyword to look up next>"}

The prompt is deliberately strict — it rejects vague "need more info" outputs
and requires the model to name the SPECIFIC missing fact and the entity used to
find it.  This prevents false "done: true" on the first hop.

If done=false and hops < maxHops, the engine runs another vector search with
nextQuery, appends the new chunks (never discarding previous hops), and re-runs
CRAG grading on the *new* chunks only.

The final accumulated chunk set is returned to the caller with per-document
labels so that the synthesis prompt can group by source.

Feature flag
────────────
Controlled by settings.ENABLE_MULTI_HOP.  When False the engine returns
immediately after hop 1, preserving the original single-shot behaviour.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Data types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class HopResult:
    """Outcome of a single retrieval hop."""
    hop_number: int
    query_used: str
    chunks: List[Dict[str, Any]]          # citation dicts with full_text, score, metadata
    crag_verdict: str                      # EvalVerdict.value string
    crag_reasoning: str
    crag_blended_score: float


@dataclass
class MultiHopResult:
    """Accumulated result returned to the chat controller."""
    hops: List[HopResult] = field(default_factory=list)
    all_chunks: List[Dict[str, Any]] = field(default_factory=list)   # de-duped, ordered
    done_reason: str = ""                  # why the loop ended (done / maxHops / noNewChunks)

    # Labelled chunks for synthesis prompt: {docLabel: [chunk_text, ...]}
    chunks_by_doc: Dict[str, List[str]] = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Hop-sufficiency judge prompt
# ─────────────────────────────────────────────────────────────────────────────

_JUDGE_SYSTEM = """\
You are a strict multi-hop retrieval judge for a document-QA system.

Your job: decide whether the chunks retrieved so far are SUFFICIENT to fully
answer the original question WITHOUT any additional document lookups.

STRICT RULES — read carefully before responding:
1. Return {done: true} ONLY if you can construct a complete, factually grounded
   answer from the chunks alone.  Do NOT return done=true merely because the
   chunks are "related" or "partially helpful."
2. Return {done: false} when ANY critical fact needed for a complete answer is
   absent from the chunks.
3. When done=false you MUST:
   a. State the SPECIFIC fact that is missing (missingFact field).
   b. Produce a SHORT, ENTITY-FOCUSED search query (nextQuery field) that
      targets exactly that missing fact.  nextQuery MUST contain a concrete
      entity name, number, date, or term extracted from the chunks retrieved
      so far — NOT a rephrase of the original question.

Examples of BAD (rejected) nextQuery values:
  x "Tell me more about the project"         <- rephrase
  x "Additional information needed"          <- vague
  x "What is the scaling strategy?"          <- clone of original question

Examples of GOOD nextQuery values:
  ok "Aurora DB read replica failover time"   <- specific entity from hop-1 chunk
  ok "Project Helios budget Q3 2024"          <- specific named project + date
  ok "Dr. Smith patent US11234567"            <- specific name + patent number

Return ONLY valid JSON (no markdown, no extra text):

{"done": true}
  OR
{
  "done": false,
  "missingFact": "<one-sentence description of the specific missing fact>",
  "nextQuery": "<entity-focused search query using facts from the chunks>"
}
"""

_JUDGE_HUMAN = """\
Original question: {original_query}

Chunks retrieved so far (across all hops):
{chunks_text}
"""

_judge_prompt = ChatPromptTemplate.from_messages([
    ("system", _JUDGE_SYSTEM),
    ("human", _JUDGE_HUMAN),
])


def _get_judge_llm(openai_api_key: str = None, gemini_api_key: str = None):
    """Return a zero-temperature LLM for the hop-sufficiency judge."""
    if openai_api_key:
        return ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=openai_api_key)
    if gemini_api_key:
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, google_api_key=gemini_api_key)
    # System-level fallback: try OpenAI env key, then Gemini env key
    if settings.OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o-mini", temperature=0, openai_api_key=settings.OPENAI_API_KEY)
    if settings.GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, google_api_key=settings.GEMINI_API_KEY)
    raise ValueError("No LLM API key available for multi-hop judge")


def _parse_json_safe(raw: str) -> dict:
    """Strip markdown fences and parse JSON; return {} on failure."""
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned.strip())
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception as e:
                logger.error("multi_hop judge JSON fallback failed: %s | raw=%s", e, raw[:200])
                return {}
        logger.error("multi_hop judge JSON parse failed | raw=%s", raw[:200])
        return {}


async def _judge_sufficiency(
    original_query: str,
    accumulated_chunks: List[Dict[str, Any]],
    openai_api_key: str = None,
    gemini_api_key: str = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Ask the LLM: "Can you fully answer the original question from what we have?"

    Returns:
        (done, missing_fact, next_query)
        done=True  -> stop hopping; missing_fact and next_query are None
        done=False -> missing_fact is the specific gap; next_query is the follow-up
    """
    chunks_text = "\n\n---\n\n".join(
        (
            f"[Hop {c.get('_hop', '?')} | "
            f"Doc: {c.get('metadata', {}).get('document_id', 'unknown')[:20]} | "
            f"Score: {c.get('score', 0.0):.3f}]\n"
            f"{c.get('full_text', c.get('text_snippet', ''))}"
        )
        for c in accumulated_chunks
    )

    llm = _get_judge_llm(openai_api_key, gemini_api_key)
    chain = _judge_prompt | llm | StrOutputParser()

    try:
        raw = await chain.ainvoke({
            "original_query": original_query,
            "chunks_text": chunks_text,
        })
        data = _parse_json_safe(raw)
        done = bool(data.get("done", False))
        if done:
            return True, None, None
        missing_fact = data.get("missingFact", "").strip()
        next_query = data.get("nextQuery", "").strip()

        # Safety: reject empty / trivially short nextQuery
        if not next_query or len(next_query) < 5:
            logger.warning("multi_hop judge returned empty/vague nextQuery — stopping early")
            return True, None, None

        return False, missing_fact, next_query

    except Exception as exc:
        logger.warning("multi_hop judge failed (%s) — treating as done=True", exc)
        return True, None, None


# ─────────────────────────────────────────────────────────────────────────────
# CRAG thin wrapper (to avoid circular imports)
# ─────────────────────────────────────────────────────────────────────────────

async def _run_crag_on_chunks(
    query: str,
    chunks: List[Dict[str, Any]],
    openai_api_key: str = None,
    gemini_api_key: str = None,
) -> Tuple[str, str, float]:
    """
    Run CRAG grading on a slice of chunks (used per-hop on the NEW chunks only).
    Returns (verdict_str, reasoning, blended_score).
    """
    from crag import evaluator as crag_evaluator  # local import avoids circular dep
    if not chunks:
        return "INCORRECT", "No chunks retrieved.", 0.0
    result = await crag_evaluator.evaluate_documents(query, chunks, openai_api_key, gemini_api_key)
    return result.verdict.value, result.reasoning, result.blended_score


# ─────────────────────────────────────────────────────────────────────────────
# Doc-label builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_chunks_by_doc(accumulated_chunks: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Groups chunk texts by source document label.
    Label = document filename (or document_id if filename absent).
    Preserves hop order within each doc bucket.
    """
    grouped: Dict[str, List[str]] = {}
    for chunk in accumulated_chunks:
        meta = chunk.get("metadata", {})
        label = (
            meta.get("file_name")
            or meta.get("filename")
            or meta.get("document_name")
            or meta.get("title")
            or meta.get("document_id", "Unknown Document")
        )
        text = chunk.get("full_text") or chunk.get("text_snippet", "")
        grouped.setdefault(label, []).append(text)
    return grouped


# ─────────────────────────────────────────────────────────────────────────────
# Deduplication helpers
# ─────────────────────────────────────────────────────────────────────────────

def _chunk_fingerprint(chunk: Dict[str, Any]) -> str:
    """
    Stable fingerprint for a chunk.  Uses metadata doc_id + first 120 chars of text
    to catch near-duplicates returned by different queries.
    """
    doc_id = chunk.get("metadata", {}).get("document_id", "")
    text_head = (chunk.get("full_text") or chunk.get("text_snippet", ""))[:120]
    return f"{doc_id}::{text_head}"


def _deduplicate(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for c in chunks:
        fp = _chunk_fingerprint(c)
        if fp not in seen:
            seen.add(fp)
            out.append(c)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

async def run_multi_hop(
    original_query: str,
    *,
    # Retrieval dependencies injected by the controller
    vector_store,
    embedding_svc,
    reranker,
    # Scoping
    workspace_id: str,
    knowledge_base_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    team_id: Optional[str] = None,
    department: Optional[str] = None,
    project: Optional[str] = None,
    # Auth
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    # Limits
    max_hops: int = 3,
    retrieve_limit: int = 15,
    rerank_top_k: int = 5,
    # Production-safety
    redis_client=None,          # injected from controller; None disables hop-cache
    latency_budget_s: float = 0.0,  # 0 = no budget enforcement
) -> MultiHopResult:
    """
    Iterative multi-hop retrieval loop.

    Hop 1 uses original_query.  Subsequent hops use entity-focused queries
    produced by the sufficiency judge.  Returns a MultiHopResult with:
      - hops          : per-hop trace (query, chunks, CRAG verdict)
      - all_chunks    : de-duped accumulation across all hops
      - chunks_by_doc : chunks grouped by source document label

    Production-safety features
    --------------------------
    * Per-hop Redis cache: each (docSetId, subQueryHash) pair is cached for
      MULTI_HOP_HOP_CACHE_TTL seconds so identical cross-doc questions against
      the same KB hit memory instead of re-running Qdrant + embedding.
    * Latency budget: if latency_budget_s > 0 and the loop has consumed more
      than latency_budget_s wall-clock seconds, the loop exits immediately
      with done_reason='latencyBudget' before starting another embed+search
      cycle.  The controller treats this the same as 'maxHops' (→ partial=True).
    """
    import time as _time  # local to avoid shadowing
    loop_start = _time.perf_counter()

    result = MultiHopResult()
    accumulated: List[Dict[str, Any]] = []
    seen_fps: set = set()
    current_query = original_query

    # Stable docset identifier used as the cache-key namespace.
    # Sorted so that the same set of doc IDs always produces the same key.
    doc_set_id = hashlib.sha256(
        ":".join(sorted(document_ids or [])).encode()
    ).hexdigest()[:16]

    def _hop_cache_key(query: str) -> str:
        q_hash = hashlib.sha256(query.strip().lower().encode()).hexdigest()[:24]
        return f"mh:hop:{doc_set_id}:{q_hash}"

    for hop_num in range(1, max_hops + 1):
        logger.info("MULTI_HOP hop=%d query=%r", hop_num, current_query)

        # -- Latency budget check (before any work this hop) -------------------
        if hop_num > 1 and latency_budget_s > 0:
            elapsed = _time.perf_counter() - loop_start
            if elapsed >= latency_budget_s:
                logger.warning(
                    "MULTI_HOP latency budget %.1fs exhausted after %.2fs at hop=%d -- stopping",
                    latency_budget_s, elapsed, hop_num,
                )
                result.done_reason = "latencyBudget"
                break

        # -- Per-hop Redis cache check -----------------------------------------
        hop_cache_key = _hop_cache_key(current_query)
        cached_hop_chunks: Optional[List[Dict[str, Any]]] = None
        if redis_client is not None:
            try:
                raw_cached = await redis_client.get(hop_cache_key)
                if raw_cached:
                    cached_hop_chunks = json.loads(raw_cached)
                    for c in cached_hop_chunks:
                        c["_hop"] = hop_num
                        c["_query_used"] = current_query
                    logger.info(
                        "MULTI_HOP hop=%d cache HIT key=%s chunks=%d",
                        hop_num, hop_cache_key, len(cached_hop_chunks),
                    )
            except Exception as e:
                logger.warning("MULTI_HOP hop=%d cache read error: %s", hop_num, e)

        if cached_hop_chunks is not None:
            hop_chunks: List[Dict[str, Any]] = cached_hop_chunks
        else:
            # -- Embed the current hop query -----------------------------------
            try:
                query_vector, _, _ = embedding_svc.embed_query(
                    current_query,
                    openai_api_key=openai_api_key,
                    gemini_api_key=gemini_api_key,
                )
            except Exception as exc:
                logger.error("MULTI_HOP hop=%d embed failed: %s", hop_num, exc)
                result.done_reason = f"embed_error_hop{hop_num}"
                break

            # -- Vector search ------------------------------------------------
            try:
                search_results = await vector_store.search(
                    query_vector=query_vector,
                    limit=retrieve_limit,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    document_ids=document_ids,
                    query_text=current_query,
                    team_id=team_id,
                    department=department,
                    project=project,
                    per_doc_floor=settings.RETRIEVAL_PER_DOC_FLOOR,
                    total_cap=settings.RETRIEVAL_TOTAL_CAP,
                )
            except Exception as exc:
                logger.error("MULTI_HOP hop=%d search failed: %s", hop_num, exc)
                result.done_reason = f"search_error_hop{hop_num}"
                break

            # -- Rerank (MMR) -------------------------------------------------
            if search_results:
                search_results = reranker.rerank(current_query, search_results, top_k=rerank_top_k)

            # -- Build citation dicts + write to Redis cache ------------------
            hop_chunks_fresh: List[Dict[str, Any]] = []
            for res in search_results:
                payload = res.payload or {}
                text = payload.get("content", "")
                meta = payload.get("metadata", {})
                c = {
                    "score": getattr(res, "score", 1.0),
                    "text_snippet": text[:150] + "..." if len(text) > 150 else text,
                    "full_text": text,
                    "metadata": meta,
                    "_hop": hop_num,
                    "_source_doc_id": meta.get("document_id", "unknown"),
                    "_query_used": current_query,
                }
                hop_chunks_fresh.append(c)

            if redis_client is not None and hop_chunks_fresh:
                try:
                    await redis_client.setex(
                        hop_cache_key,
                        settings.MULTI_HOP_HOP_CACHE_TTL,
                        json.dumps(hop_chunks_fresh),
                    )
                    logger.info(
                        "MULTI_HOP hop=%d cache WRITE key=%s chunks=%d",
                        hop_num, hop_cache_key, len(hop_chunks_fresh),
                    )
                except Exception as e:
                    logger.warning("MULTI_HOP hop=%d cache write error: %s", hop_num, e)

            hop_chunks = hop_chunks_fresh

        # ── Deduplicate vs previous hops ──────────────────────────────────────
        new_chunks: List[Dict[str, Any]] = []
        for c in hop_chunks:
            fp = _chunk_fingerprint(c)
            if fp not in seen_fps:
                seen_fps.add(fp)
                new_chunks.append(c)

        if not new_chunks and hop_num > 1:
            logger.info("MULTI_HOP hop=%d: no new chunks after dedup — stopping", hop_num)
            result.done_reason = "noNewChunks"
            break

        # ── CRAG on NEW chunks only (per-hop, not cumulative) ─────────────────
        crag_verdict, crag_reasoning, crag_score = await _run_crag_on_chunks(
            current_query, new_chunks, openai_api_key, gemini_api_key
        )
        logger.info(
            "MULTI_HOP hop=%d CRAG verdict=%s score=%.3f reasoning=%r",
            hop_num, crag_verdict, crag_score, crag_reasoning[:80],
        )

        # Record hop
        hop_result = HopResult(
            hop_number=hop_num,
            query_used=current_query,
            chunks=new_chunks,
            crag_verdict=crag_verdict,
            crag_reasoning=crag_reasoning,
            crag_blended_score=crag_score,
        )
        result.hops.append(hop_result)
        accumulated.extend(new_chunks)

        # ── Early exit: maxHops reached ────────────────────────────────────────
        if hop_num >= max_hops:
            logger.info("MULTI_HOP maxHops=%d reached — stopping", max_hops)
            result.done_reason = "maxHops"
            break

        # ── Sufficiency judge: runs AFTER accumulating hop chunks ─────────────
        done, missing_fact, next_query = await _judge_sufficiency(
            original_query,
            accumulated,
            openai_api_key,
            gemini_api_key,
        )

        logger.info(
            "MULTI_HOP hop=%d judge: done=%s missingFact=%r nextQuery=%r",
            hop_num, done, missing_fact, next_query,
        )

        if done:
            result.done_reason = "judge_done"
            break

        # Guard: reject nextQuery that is a verbatim rephrase of original
        if next_query and next_query.strip().lower() == original_query.strip().lower():
            logger.warning(
                "MULTI_HOP hop=%d nextQuery identical to original — stopping to avoid loop",
                hop_num,
            )
            result.done_reason = "nextQuery_rephrase"
            break

        current_query = next_query  # feed into next hop

    # ── Finalise ───────────────────────────────────────────────────────────────
    result.all_chunks = _deduplicate(accumulated)
    result.chunks_by_doc = _build_chunks_by_doc(result.all_chunks)

    logger.info(
        "MULTI_HOP complete: hops=%d total_chunks=%d done_reason=%r",
        len(result.hops), len(result.all_chunks), result.done_reason,
    )
    return result
