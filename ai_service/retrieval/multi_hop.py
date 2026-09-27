"""
Multi-hop retrieval engine (feat/mult-hop-retrival).

Architecture
────────────
Hop 1  = the same retrieval the single-shot path runs (vector search with
          per-doc floor → MMR rerank to RETRIEVAL_TOTAL_CAP), using the query
          vector the controller already computed.

After each hop the *hop-sufficiency judge* makes a single LLM call:

    Input : {originalQuery, chunksRetrievedSoFar}
    Output: {done: true}
             OR
            {done: false, missingFact: "<what is still needed>",
             nextQuery: "<exact entity/keyword to look up next>"}

The prompt is deliberately strict — it rejects vague "need more info" outputs
and requires the model to name the SPECIFIC missing fact and the entity used to
find it.  This prevents false "done: true" on the first hop.

If done=false and hops < maxHops, the engine runs a targeted vector search with
nextQuery (no per-doc floor — the query names one entity, so forcing chunks from
every doc would only dilute it) and appends the new chunks, never discarding
previous hops.

The controller runs one holistic CRAG evaluation over the accumulated set;
there is no per-hop CRAG call.

Routing
───────
The controller decides whether to hop (see _should_run_multi_hop); the global
kill-switch is settings.ENABLE_MULTI_HOP.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from core.config import settings
from crag.evaluator import _get_llm, _parse_json_safe

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Data types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class HopResult:
    """Outcome of a single retrieval hop."""
    hop_number: int
    query_used: str
    chunks: List[Dict[str, Any]]          # NEW citation dicts found by this hop


@dataclass
class MultiHopResult:
    """Accumulated result returned to the chat controller."""
    hops: List[HopResult] = field(default_factory=list)
    all_chunks: List[Dict[str, Any]] = field(default_factory=list)   # de-duped, hop order
    done_reason: str = ""                  # why the loop ended (judge_done / maxHops / ...)

    # Labelled chunks for synthesis prompt: {docLabel: [chunk_text, ...]}
    chunks_by_doc: Dict[str, List[str]] = field(default_factory=dict)

    @property
    def partial(self) -> bool:
        """True unless the judge confirmed the chunks answer the question."""
        return self.done_reason != "judge_done"


# ─────────────────────────────────────────────────────────────────────────────
# Hop-sufficiency judge prompt
# (literal JSON braces are doubled — ChatPromptTemplate treats {x} as a variable)
# ─────────────────────────────────────────────────────────────────────────────

_JUDGE_SYSTEM = """\
You are a strict multi-hop retrieval judge for a document-QA system.

Your job: decide whether the chunks retrieved so far are SUFFICIENT to fully
answer the original question WITHOUT any additional document lookups.

STRICT RULES — read carefully before responding:
1. Return {{"done": true}} ONLY if you can construct a complete, factually grounded
   answer from the chunks alone.  Do NOT return done=true merely because the
   chunks are "related" or "partially helpful."
2. Return {{"done": false}} when ANY critical fact needed for a complete answer is
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

{{"done": true}}
  OR
{{
  "done": false,
  "missingFact": "<one-sentence description of the specific missing fact>",
  "nextQuery": "<entity-focused search query using facts from the chunks>"
}}
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


def _doc_label(meta: Dict[str, Any]) -> str:
    """Human-readable source label: gateway-supplied name, else parser metadata, else id."""
    return (
        meta.get("document_name")
        or meta.get("file_name")
        or meta.get("filename")
        or meta.get("title")
        or meta.get("document_id", "Unknown Document")
    )


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

    LLM/provider errors propagate so the caller can record them — swallowing
    them as done=True is what hid the broken prompt and retired models.
    """
    chunks_text = "\n\n---\n\n".join(
        (
            f"[Hop {c.get('_hop', '?')} | "
            f"Doc: {_doc_label(c.get('metadata', {}))} | "
            f"Score: {c.get('score') or 0.0:.3f}]\n"
            f"{c.get('full_text', c.get('text_snippet', ''))}"
        )
        for c in accumulated_chunks
    )

    chain = _judge_prompt | _get_llm(openai_api_key, gemini_api_key) | StrOutputParser()
    raw = await chain.ainvoke({
        "original_query": original_query,
        "chunks_text": chunks_text,
    })
    data = _parse_json_safe(raw)
    if data.get("done", False):
        return True, None, None
    missing_fact = str(data.get("missingFact") or "").strip()
    next_query = str(data.get("nextQuery") or "").strip()

    # Safety: reject empty / trivially short nextQuery
    if len(next_query) < 5:
        logger.warning("multi_hop judge returned empty/vague nextQuery — stopping early")
        return True, None, None

    return False, missing_fact, next_query


# ─────────────────────────────────────────────────────────────────────────────
# Doc-label builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_chunks_by_doc(accumulated_chunks: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Groups chunk texts by source document label, preserving hop order within
    each doc bucket.
    """
    grouped: Dict[str, List[str]] = {}
    for chunk in accumulated_chunks:
        label = _doc_label(chunk.get("metadata", {}))
        text = chunk.get("full_text") or chunk.get("text_snippet", "")
        grouped.setdefault(label, []).append(text)
    return grouped


def _chunk_fingerprint(chunk: Dict[str, Any]) -> str:
    """
    Stable fingerprint for a chunk.  Uses metadata doc_id + first 120 chars of text
    to catch near-duplicates returned by different queries.
    """
    doc_id = chunk.get("metadata", {}).get("document_id", "")
    text_head = (chunk.get("full_text") or chunk.get("text_snippet", ""))[:120]
    return f"{doc_id}::{text_head}"


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
    rerank_top_k: int = 5,          # chunks kept per follow-up hop
    # Production-safety
    redis_client=None,          # injected from controller; None disables hop-cache
    latency_budget_s: float = 0.0,  # 0 = no budget enforcement
    # Reuse
    query_vector: Optional[List[float]] = None,       # hop-1 vector already embedded by the controller
    document_names: Optional[Dict[str, str]] = None,  # {document_id: display name} from the gateway
) -> MultiHopResult:
    """
    Iterative multi-hop retrieval loop.

    Hop 1 uses original_query.  Subsequent hops use entity-focused queries
    produced by the sufficiency judge.  Returns a MultiHopResult with:
      - hops          : per-hop trace (query, new chunks)
      - all_chunks    : de-duped accumulation across all hops
      - chunks_by_doc : chunks grouped by source document label

    Production-safety features
    --------------------------
    * Per-hop Redis cache keyed on the full retrieval scope (collection,
      workspace, KB, doc set, metadata filters), hop kind and sub-query, for
      MULTI_HOP_HOP_CACHE_TTL seconds.
    * Latency budget: if latency_budget_s > 0 and the loop has consumed more
      than latency_budget_s wall-clock seconds, the loop exits before starting
      another embed+search cycle with done_reason='latencyBudget'.
    * A follow-up embedding whose dimension differs from hop 1 (provider
      fallback) stops the loop instead of querying the wrong collection.
    """
    loop_start = time.perf_counter()

    result = MultiHopResult()
    accumulated: List[Dict[str, Any]] = []
    seen_fps: set = set()
    current_query = original_query
    expected_dim = len(query_vector) if query_vector else None

    # Everything that changes which chunks a search can return goes into the
    # cache namespace, so two tenants/scopes can never share an entry.
    scope_id = hashlib.sha256(json.dumps([
        getattr(vector_store, "collection_name", ""),
        workspace_id, knowledge_base_id, sorted(document_ids or []),
        team_id, department, project,
    ]).encode()).hexdigest()[:16]

    for hop_num in range(1, max_hops + 1):
        is_first = hop_num == 1
        logger.info("MULTI_HOP hop=%d query=%r", hop_num, current_query)

        # -- Latency budget check (before any work this hop) -------------------
        if not is_first and latency_budget_s > 0:
            elapsed = time.perf_counter() - loop_start
            if elapsed >= latency_budget_s:
                logger.warning(
                    "MULTI_HOP latency budget %.1fs exhausted after %.2fs at hop=%d -- stopping",
                    latency_budget_s, elapsed, hop_num,
                )
                result.done_reason = "latencyBudget"
                break

        # -- Per-hop Redis cache check -----------------------------------------
        q_hash = hashlib.sha256(current_query.strip().lower().encode()).hexdigest()[:24]
        hop_cache_key = f"mh:hop:{scope_id}:{'first' if is_first else 'follow'}:{q_hash}"
        hop_chunks: Optional[List[Dict[str, Any]]] = None
        if redis_client is not None:
            try:
                raw_cached = await redis_client.get(hop_cache_key)
                if raw_cached:
                    hop_chunks = json.loads(raw_cached)
                    for c in hop_chunks:
                        c["_hop"] = hop_num
                        c["_query_used"] = current_query
                    logger.info(
                        "MULTI_HOP hop=%d cache HIT key=%s chunks=%d",
                        hop_num, hop_cache_key, len(hop_chunks),
                    )
            except Exception as e:
                logger.warning("MULTI_HOP hop=%d cache read error: %s", hop_num, e)

        if hop_chunks is None:
            # -- Embed the current hop query (hop 1 reuses the controller's vector)
            if is_first and query_vector is not None:
                hop_vector = query_vector
            else:
                try:
                    # embed_query is a blocking HTTP call — keep it off the event loop
                    # OpenAI only, like the controller — the index is OpenAI-embedded
                    hop_vector, _, _ = await asyncio.to_thread(
                        embedding_svc.embed_query,
                        current_query,
                        openai_api_key=openai_api_key or None,
                    )
                except Exception as exc:
                    logger.error("MULTI_HOP hop=%d embed failed: %s", hop_num, exc)
                    result.done_reason = f"embed_error_hop{hop_num}"
                    break
                if expected_dim is None:
                    expected_dim = len(hop_vector)
                elif len(hop_vector) != expected_dim:
                    logger.error(
                        "MULTI_HOP hop=%d embedding dim %d != hop-1 dim %d (provider fallback) — stopping",
                        hop_num, len(hop_vector), expected_dim,
                    )
                    result.done_reason = f"embed_provider_mismatch_hop{hop_num}"
                    break

            # -- Vector search ------------------------------------------------
            try:
                search_results = await vector_store.search(
                    query_vector=hop_vector,
                    limit=retrieve_limit,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    document_ids=document_ids,
                    query_text=current_query,
                    team_id=team_id,
                    department=department,
                    project=project,
                    per_doc_floor=settings.RETRIEVAL_PER_DOC_FLOOR if is_first else 0,
                    total_cap=settings.RETRIEVAL_TOTAL_CAP,
                )
            except Exception as exc:
                logger.error("MULTI_HOP hop=%d search failed: %s", hop_num, exc)
                result.done_reason = f"search_error_hop{hop_num}"
                break

            # -- Rerank (MMR) -------------------------------------------------
            # Hop 1 keeps the single-shot budget so the per-doc floor survives;
            # follow-up hops keep only the few chunks that answer the sub-query.
            if search_results:
                top_k = settings.RETRIEVAL_TOTAL_CAP if is_first else rerank_top_k
                search_results = reranker.rerank(current_query, search_results, top_k=top_k)

            # -- Build citation dicts + write to Redis cache ------------------
            hop_chunks = []
            for res in search_results:
                payload = res.payload or {}
                text = payload.get("content", "")
                meta = payload.get("metadata", {})
                hop_chunks.append({
                    "score": getattr(res, "score", 1.0),
                    "text_snippet": text[:150] + "..." if len(text) > 150 else text,
                    "full_text": text,
                    "metadata": meta,
                    "_hop": hop_num,
                    "_source_doc_id": meta.get("document_id", "unknown"),
                    "_query_used": current_query,
                })

            if redis_client is not None and hop_chunks:
                try:
                    await redis_client.setex(
                        hop_cache_key,
                        settings.MULTI_HOP_HOP_CACHE_TTL,
                        json.dumps(hop_chunks),
                    )
                except Exception as e:
                    logger.warning("MULTI_HOP hop=%d cache write error: %s", hop_num, e)

        # ── Deduplicate vs previous hops ──────────────────────────────────────
        new_chunks: List[Dict[str, Any]] = []
        for c in hop_chunks:
            fp = _chunk_fingerprint(c)
            if fp not in seen_fps:
                seen_fps.add(fp)
                new_chunks.append(c)

        if not new_chunks and not is_first:
            logger.info("MULTI_HOP hop=%d: no new chunks after dedup — stopping", hop_num)
            result.done_reason = "noNewChunks"
            break

        # Attach display names (after the cache write, so renames never go stale in Redis)
        if document_names:
            for c in new_chunks:
                name = document_names.get(c["metadata"].get("document_id"))
                if name:
                    c["metadata"] = {**c["metadata"], "document_name": name}

        result.hops.append(HopResult(hop_number=hop_num, query_used=current_query, chunks=new_chunks))
        accumulated.extend(new_chunks)

        # ── Early exit: maxHops reached ────────────────────────────────────────
        if hop_num >= max_hops:
            logger.info("MULTI_HOP maxHops=%d reached — stopping", max_hops)
            result.done_reason = "maxHops"
            break

        # ── Sufficiency judge: runs AFTER accumulating hop chunks ─────────────
        try:
            done, missing_fact, next_query = await _judge_sufficiency(
                original_query,
                accumulated,
                openai_api_key,
                gemini_api_key,
            )
        except Exception:
            # Answer from what we have, but flag it partial (not "judge_done")
            logger.exception("MULTI_HOP hop=%d judge call failed — stopping", hop_num)
            result.done_reason = "judge_error"
            break

        logger.info(
            "MULTI_HOP hop=%d judge: done=%s missingFact=%r nextQuery=%r",
            hop_num, done, missing_fact, next_query,
        )

        if done:
            result.done_reason = "judge_done"
            break

        # Guard: reject nextQuery that is a verbatim rephrase of original
        if next_query.strip().lower() == original_query.strip().lower():
            logger.warning(
                "MULTI_HOP hop=%d nextQuery identical to original — stopping to avoid loop",
                hop_num,
            )
            result.done_reason = "nextQuery_rephrase"
            break

        current_query = next_query  # feed into next hop

    # ── Finalise ───────────────────────────────────────────────────────────────
    result.all_chunks = accumulated  # already de-duplicated via seen_fps
    result.chunks_by_doc = _build_chunks_by_doc(accumulated)

    logger.info(
        "MULTI_HOP complete: hops=%d total_chunks=%d done_reason=%r",
        len(result.hops), len(result.all_chunks), result.done_reason,
    )
    return result
