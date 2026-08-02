import logging
import asyncio
import json
import time
from typing import List, Optional
from fastapi import BackgroundTasks
from llm.rag_chain import RAGChain

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
):
    """
    Streams the final RAG answer back to the client.

    synthesized=True:
      Emits a "synthesis_mode" SSE event before the answer tokens so the
      frontend can render the SynthesisBadge on this message. This is a
      distinct signal from the hallucination-warning badge — it means the
      answer was composed by combining multiple document sections, not that
      it may contain fabricated content.
    """
    t_llm_start = time.perf_counter()
    first_token_time = None

    # Emit citations first
    citations_event = f"data: {{\"event\": \"citations\", \"data\": {json.dumps(citations)}}}\n\n"
    yield citations_event

    # Phase 3: emit synthesis_mode event so the frontend can badge this answer
    if synthesized:
        synthesis_event = (
            "data: {\"event\": \"synthesis_mode\", \"data\": "
            "{\"reason\": \"Answer synthesized from multiple sections of your document.\"}}\n\n"
        )
        yield synthesis_event

    full_answer = ""
    async for chunk in rag_chain.stream_answer(
        question,
        context_docs,
        history,
        openai_api_key=x_openai_api_key,
        gemini_api_key=x_gemini_api_key,
        conservative=conservative
    ):
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

        if history:
            bg_tasks.add_task(compress_history_task, chat_id, history, redis_client, x_openai_api_key, x_gemini_api_key)

    yield "data: [DONE]\n\n"
