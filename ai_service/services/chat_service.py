import logging
import asyncio
import json
import time
import os
from typing import List, Optional
from fastapi import BackgroundTasks
from llm.rag_chain import RAGChain
from services.credit_accounting import estimate_prompt_tokens, credits_for_usage, debit_credits, CREDIT_RATES
from core.config import settings

logger = logging.getLogger(__name__)

rag_chain = RAGChain()


async def save_chat_to_db(chat_id: str, query: str, response: str, workspace_id: str):
    """Mock background task for persistence to Postgres."""
    await asyncio.sleep(0.05)
    logger.info(f"Saved chat {chat_id} to Postgres database.")


async def compress_history_task(chat_id: str, history: list[dict], redis_client, openai_key, gemini_key):
    """Background task to compress history if it exceeds 10 messages."""
    if len(history) > 10:
        summary = await rag_chain.summarize_history(history, openai_key, gemini_key)
        await redis_client.setex(f"chat_summary:{chat_id}", 3600 * 24, summary)
        logger.info(f"Compressed history for chat {chat_id} into summary.")


async def log_analytics_event(event_type: str, data: dict):
    """Mock background task for analytics & quota tracking."""
    await asyncio.sleep(0.02)
    logger.info(f"Logged analytics event: {event_type}")


def system_embedding_credits(texts: List[str]) -> int:
    """Credits for embedding `texts` on the system OpenAI key (min 1 when any text)."""
    if not texts:
        return 0
    tokens = estimate_prompt_tokens("text-embedding-3-small", texts, [])
    return credits_for_usage("embedding-default", tokens, 0)


async def debit_wallet_task(
    user_id: str,
    uses_system_key: bool,
    model: str,
    question: str,
    context_docs: List[str],
    answer: str,
    history: List[dict],
    extra_prompt_tokens: int = 0,
    extra_completion_tokens: int = 0,
    did_web_search: bool = False,
    actual_usage: dict = None,
    cost_multiplier: float = 1.0,   # >1.0 for multi-hop KB queries
    system_credits: int = 0,        # system resources used by a BYOK request (query embeddings)
):
    if not user_id:
        return

    prompt_tokens = completion_tokens = 0
    cost = 0
    # LLM tokens are only billed when they ran on the system key; BYOK users pay their provider.
    if uses_system_key:
        if actual_usage:
            prompt_tokens = actual_usage.get("input_tokens", 0) + extra_prompt_tokens
            completion_tokens = actual_usage.get("output_tokens", 0) + extra_completion_tokens
        else:
            # Estimate prompt
            messages = history + [{"role": "user", "content": question}]
            prompt_tokens = estimate_prompt_tokens(model, messages, context_docs) + extra_prompt_tokens

            # Estimate completion
            completion_tokens = estimate_prompt_tokens(model, [{"content": answer}], []) + extra_completion_tokens

        cost = credits_for_usage(model, prompt_tokens, completion_tokens)

        # Apply multiplier for multi-hop KB queries (extra LLM judge calls + embed rounds)
        if cost_multiplier != 1.0:
            cost = round(cost * cost_multiplier)

    # System resources are billed to everyone, including BYOK users.
    cost += system_credits
    if did_web_search:  # Tavily always runs on the system key
        cost += CREDIT_RATES.get("web-search", {}).get("perRequest", 10)
    if cost <= 0:
        return
        
    await debit_credits(user_id, cost, "DEBIT_CHAT", {
        "model": model, "prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
        "web_search": did_web_search, "byok": not uses_system_key, "system_credits": system_credits,
    })


async def _stream_final_answer(
    question: str,
    context_docs: List[str],
    citations: List[dict],
    history: List[dict],
    chat_id: str,
    workspace_id: str,
    redis_client,
    bg_tasks: BackgroundTasks,
    x_openai_api_key: Optional[str],
    x_gemini_api_key: Optional[str],
    full_resp_key: Optional[str] = None,
    t0: float = None,
    t_embed: float = 0,
    t_search: float = 0,
    conservative: bool = False,
    synthesized: bool = False,
    user_id: Optional[str] = None,
    uses_system_key: bool = False,
    model: str = "gpt-4o",
    extra_prompt_tokens: int = 0,
    extra_completion_tokens: int = 0,
    did_web_search: bool = False,
    # ── Multi-hop additions ────────────────────────────────────────────────────
    chunks_by_doc: Optional[dict] = None,   # {docLabel: [text]} from multi-hop path
    hop_trace: Optional[list] = None,       # list of HopResult dicts for SSE event
    partial: bool = False,                  # True when maxHops hit without done=True
    cost_multiplier: float = 1.0,           # >1.0 for multi-hop KB queries
    system_credits: int = 0,                # BYOK: system resources used (see debit_wallet_task)
):
    """
    Streams the final RAG answer back to the client.

    synthesized=True:
      Emits a "synthesis_mode" SSE event before the answer tokens so the
      frontend can render the SynthesisBadge on this message.

    partial=True (multi-hop only):
      Signals that the hop loop exited because maxHops was reached, not because
      the judge returned done=True.  Emits partial:true in the synthesis_mode
      SSE payload so the frontend can surface "may be incomplete", and prepends
      a PARTIAL_RETRIEVAL marker in the prompt context so the model warns the user.
    """

    t_llm_start = time.perf_counter()
    first_token_time = None

    # Emit citations first
    citations_event = f"data: {{\"event\": \"citations\", \"data\": {json.dumps(citations)}}}\n\n"
    yield citations_event

    # Phase 3: emit synthesis_mode event so the frontend can badge this answer.
    # For multi-doc sessions: include partial flag and a doc-aware reason string.
    if synthesized:
        if chunks_by_doc:
            syn_reason = "Answer synthesized from multiple documents."
        else:
            syn_reason = "Answer synthesized from multiple sections of your document."
        synthesis_payload = json.dumps({
            "reason": syn_reason,
            "multi_doc": bool(chunks_by_doc),
            "partial": partial,
        })
        yield f"data: {{\"event\": \"synthesis_mode\", \"data\": {synthesis_payload}}}\n\n"

    # Multi-hop: emit the hop trace so callers can inspect the query chain
    if hop_trace:
        yield f"data: {{\"event\": \"multi_hop_trace\", \"data\": {json.dumps(hop_trace)}}}\n\n"

    full_answer = ""
    actual_usage = None

    # Route to multi-doc synthesiser when we have doc-grouped context (multi-hop path),
    # otherwise fall back to the existing flat-join stream.
    if chunks_by_doc:
        stream_gen = rag_chain.stream_answer_multi_doc(
            question,
            chunks_by_doc,
            history,
            openai_api_key=x_openai_api_key,
            gemini_api_key=x_gemini_api_key,
            partial=partial,
        )
    else:
        stream_gen = rag_chain.stream_answer(
            question,
            context_docs,
            history,
            openai_api_key=x_openai_api_key,
            gemini_api_key=x_gemini_api_key,
            conservative=conservative,
        )

    async for chunk in stream_gen:
        if isinstance(chunk, dict) and "usage_metadata" in chunk:
            actual_usage = chunk["usage_metadata"]
            continue

        if first_token_time is None:
            first_token_time = time.perf_counter() - t_llm_start

        chunk_str = json.dumps(chunk)
        yield f"data: {chunk_str}\n\n"

        if isinstance(chunk, str):
            full_answer += chunk
        elif isinstance(chunk, dict) and "content" in chunk:
            full_answer += chunk["content"]

    t_llm_total = time.perf_counter() - t_llm_start
    t_total = time.perf_counter() - (t0 or time.perf_counter())

    metrics = {
        "embedding_time": round(t_embed, 3),
        "qdrant_search_time": round(t_search, 3),
        "llm_first_token_time": round(first_token_time, 3) if first_token_time else None,
        "llm_total_time": round(t_llm_total, 3),
        "total_time": round(t_total, 3),
    }
    logger.info(json.dumps({"event": "rag_query_metrics", "metrics": metrics}))

    if full_answer:
        if full_resp_key:
            cache_payload = json.dumps({
                "content": full_answer,
                "cached": True,
                "citations": citations,
                "synthesized": synthesized,
            })
            await redis_client.setex(full_resp_key, 43200, cache_payload)

        bg_tasks.add_task(save_chat_to_db, chat_id, question, full_answer, workspace_id)
        bg_tasks.add_task(log_analytics_event, "chat_query", metrics)
        bg_tasks.add_task(debit_wallet_task, user_id, uses_system_key, model, question, context_docs, full_answer, history, extra_prompt_tokens, extra_completion_tokens, did_web_search, actual_usage, cost_multiplier, system_credits)

        if history:
            bg_tasks.add_task(compress_history_task, chat_id, history, redis_client, x_openai_api_key, x_gemini_api_key)

    yield "data: [DONE]\n\n"
