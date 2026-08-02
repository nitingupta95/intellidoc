import logging
import time
import json
import asyncio
import hashlib
import uuid
import re
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi import BackgroundTasks

from schemas.chat import ChatRequest, ResolveRequest
from services.chat_service import _stream_final_answer
from embeddings.embedding_service import EmbeddingService
from retrieval.reranker import reranker
from core.dependencies import get_vector_store
from core.config import settings
from crag.models import EvalVerdict, PendingCRAGContext, Answerability
from crag import evaluator as crag_evaluator
from crag import refiner as crag_refiner
from crag import web_search as crag_web_search
from crag import pending_store as crag_pending_store

logger = logging.getLogger(__name__)
embedding_svc = EmbeddingService()


async def handle_chat_query(
    request: ChatRequest,
    bg_tasks: BackgroundTasks,
    redis_client,
    x_openai_api_key: str,
    x_gemini_api_key: str,
    user: dict
):
    try:
        t0 = time.perf_counter()
        logger.error(f"CHAT ENDPOINT REACHED FOR QUERY: {request.query}")

        q_hash = hashlib.sha256(request.query.encode()).hexdigest()
        doc_ids_str = ",".join(sorted(request.document_ids)) if request.document_ids else "all"
        kb_id_str = request.knowledge_base_id or "none"
        full_resp_key = f"resp:{request.workspace_id}:{kb_id_str}:{doc_ids_str}:{q_hash}"

        cached_response = await redis_client.get(full_resp_key)
        if cached_response:
            logger.info("Full response cache hit!")
            async def cached_generator():
                cache_data = json.loads(cached_response)
                if "citations" in cache_data:
                    yield f"data: {{\"event\": \"citations\", \"data\": {json.dumps(cache_data['citations'])} }}\n\n"
                if cache_data.get("synthesized"):
                    yield f"data: {{\"event\": \"synthesis_mode\", \"data\": {{\"reason\": \"Synthesized from document sections.\"}}}}\n\n"
                yield f"data: {json.dumps(cache_data.get('content', ''))}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(cached_generator(), media_type="text/event-stream")

        chat_id = request.history[-1].get("chat_id", "default") if request.history else "default"

        async def get_or_create_embedding(query, emb_cache_key):
            cached_emb = await redis_client.get(emb_cache_key)
            if cached_emb:
                logger.info("Embedding cache hit!")
                emb_data = json.loads(cached_emb)
                return emb_data["vector"], emb_data["provider"], emb_data["dim"]
            else:
                vector, prov, d = embedding_svc.embed_query(query, openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key)
                await redis_client.setex(emb_cache_key, 30 * 24 * 3600, json.dumps({"vector": vector, "provider": prov, "dim": d}))
                return vector, prov, d

        async def fetch_chat_history(c_id: str):
            await asyncio.sleep(0.01)
            return []

        emb_cache_key = f"emb:{q_hash}"
        (query_vector, provider, dim), fetched_history = await asyncio.gather(
            get_or_create_embedding(request.query, emb_cache_key),
            fetch_chat_history(chat_id)
        )

        t_embed = time.perf_counter() - t0
        t_search_start = time.perf_counter()

        vs = await get_vector_store(provider=provider, dimension=dim)

        SUMMARY_REQUEST_PATTERN = re.compile(
            r"\b(summar(y|ize|ise)|overview|tldr|recap)\b.*\b(doc|document|pdf|file|whole|entire|this)\b"
            r"|\b(chapter|section|lecture)s?\b.*\b(by|wise|one by one)\b",
            re.IGNORECASE,
        )

        is_summary_request = bool(SUMMARY_REQUEST_PATTERN.search(request.query))

        if is_summary_request:
            logger.info("Summary request detected: bypassing vector search and fetching all chunks.")
            # Fetch all chunks using scroll
            search_results = await vs.scroll_chunks(
                workspace_id=request.workspace_id,
                knowledge_base_id=request.knowledge_base_id,
                document_ids=request.document_ids,
                limit=1000, # Large limit to get all chunks
                team_id=request.team_id,
                department=request.department,
                project=request.project
            )
            # Sort by chunk index if available to maintain natural order
            search_results = sorted(search_results, key=lambda x: x.payload.get("metadata", {}).get("chunk_index", 0))
        else:
            search_results = await vs.search(
                query_vector=query_vector,
                limit=15,
                workspace_id=request.workspace_id,
                knowledge_base_id=request.knowledge_base_id,
                document_ids=request.document_ids,
                query_text=request.query,
                team_id=request.team_id,
                department=request.department,
                project=request.project
            )
            print(f"DEBUG: vs.search returned {len(search_results)} results for document_ids={request.document_ids} workspace_id={request.workspace_id}")
            if search_results:
                search_results = reranker.rerank(request.query, search_results, top_k=5)
                print(f"DEBUG: after rerank {len(search_results)}")

        retrieved_docs = []
        citations = []
        for res in search_results:
            payload = res.payload or {}
            text = payload.get("content", "")
            retrieved_docs.append(text)
            citations.append({
                "score": getattr(res, "score", 1.0),
                "text_snippet": text[:150] + "..." if len(text) > 150 else text,
                "full_text": text,
                "metadata": payload.get("metadata", {}),
            })

        if not retrieved_docs:
            retrieved_docs = ["No relevant context found in documents."]

        t_search = time.perf_counter() - t_search_start

        if is_summary_request:
            # Bypass CRAG completely for whole-document structural summaries
            # If the text is massive, we might want to batch, but for now we rely on the large context window.
            context_to_use = [" ".join(retrieved_docs)]
            logger.info(f"Bypassing CRAG for summary. Total context length: {len(context_to_use[0])} chars.")
            return StreamingResponse(
                _stream_final_answer(
                    request.query, context_to_use, citations, request.history, chat_id,
                    request.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
                    full_resp_key, t0, t_embed, t_search,
                    synthesized=True,
                ),
                media_type="text/event-stream"
            )

        eval_result = await crag_evaluator.evaluate_documents(
            request.query, citations, x_openai_api_key, x_gemini_api_key
        )

        # ── CORRECT verdict (DIRECT or blended-score SYNTHESIZABLE) ──────────
        if eval_result.verdict == EvalVerdict.CORRECT:
            is_synthesized = (
                settings.CRAG_SYNTHESIS_ENABLED
                and eval_result.answerability == Answerability.SYNTHESIZABLE
            )

            refined_context = await crag_refiner.refine(
                request.query, "CORRECT", eval_result.good_docs,
                openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key
            )
            context_to_use = [refined_context] if refined_context else retrieved_docs
            final_citations = eval_result.good_docs if eval_result.good_docs else citations

            return StreamingResponse(
                _stream_final_answer(
                    request.query, context_to_use, final_citations, request.history, chat_id,
                    request.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
                    full_resp_key, t0, t_embed, t_search,
                    synthesized=is_synthesized,
                ),
                media_type="text/event-stream"
            )

        # ── AMBIGUOUS verdict with SYNTHESIZABLE answerability ────────────────
        # Phase 3: attempt best-effort synthesis instead of immediately blocking
        if (
            eval_result.verdict == EvalVerdict.AMBIGUOUS
            and settings.CRAG_SYNTHESIS_ENABLED
            and eval_result.answerability == Answerability.SYNTHESIZABLE
        ):
            logger.info(
                "CRAG AMBIGUOUS+SYNTHESIZABLE: attempting best-effort synthesis for query_hash=%s",
                hashlib.sha256(request.query.encode()).hexdigest()[:12]
            )
            refined_context = await crag_refiner.refine(
                request.query, "CORRECT", eval_result.good_docs or citations,
                openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key
            )
            if refined_context:
                return StreamingResponse(
                    _stream_final_answer(
                        request.query, [refined_context], eval_result.good_docs or citations,
                        request.history, chat_id, request.workspace_id, redis_client, bg_tasks,
                        x_openai_api_key, x_gemini_api_key,
                        full_resp_key=None,  # don't cache ambiguous synthesis
                        t0=t0, t_embed=t_embed, t_search=t_search,
                        synthesized=True,
                    ),
                    media_type="text/event-stream"
                )
            # Synthesis produced nothing useful → fall through to confirmation flow

        # ── INCORRECT / INSUFFICIENT / unresolvable AMBIGUOUS → confirm flow ─
        pending_id = str(uuid.uuid4())
        ctx = PendingCRAGContext(
            pending_id=pending_id,
            query=request.query,
            verdict=eval_result.verdict,
            good_docs=eval_result.good_docs if eval_result.good_docs else citations,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            document_ids=request.document_ids,
            history=request.history or [],
            created_at=time.time(),
            answerability=eval_result.answerability,
            document_summaries=request.document_summaries,
        )
        await crag_pending_store.save_pending_context(redis_client, ctx)

        async def needs_confirmation_generator():
            yield (
                f"data: {{\"event\": \"needs_confirmation\", \"data\": {{"
                f"\"pending_id\": \"{pending_id}\", "
                f"\"verdict\": \"{eval_result.verdict.value}\", "
                f"\"reason\": \"{eval_result.reason}\", "
                f"\"good_docs_count\": {len(citations)}, "
                f"\"answerability\": \"{eval_result.answerability.value}\""
                f"}}}}\n\n"
            )
            yield "data: [DONE]\n\n"

        return StreamingResponse(needs_confirmation_generator(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": str(e)})


async def handle_chat_resolve(
    request: ResolveRequest,
    bg_tasks: BackgroundTasks,
    redis_client,
    x_openai_api_key: str,
    x_gemini_api_key: str,
    user: dict
):
    ctx = await crag_pending_store.load_pending_context(redis_client, request.pending_id)

    if ctx is None:
        return JSONResponse(
            status_code=410,
            content={"error": "This confirmation has expired or was already used. Please ask your question again."}
        )

    chat_id = ctx.history[-1].get("chat_id", "default") if ctx.history else "default"

    if request.consent:
        rewritten = await crag_web_search.rewrite_query(ctx.query, x_openai_api_key, x_gemini_api_key)
        web_docs = await crag_web_search.web_search(rewritten, document_summaries=ctx.document_summaries, openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key)
        refined_context = await crag_refiner.refine(
            ctx.query, ctx.verdict, ctx.good_docs, web_docs,
            openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key
        )
        citations_for_stream = ctx.good_docs + [
            {
                "score": None,
                "text_snippet": w["page_content"][:150] + "..." if len(w["page_content"]) > 150 else w["page_content"],
                "full_text": w["page_content"],
                "metadata": w["metadata"]
            } for w in web_docs
        ]
        if refined_context:
            context_to_use = [refined_context]
        else:
            context_to_use = [w["page_content"] for w in web_docs]
        return StreamingResponse(_stream_final_answer(
            ctx.query, context_to_use, citations_for_stream, ctx.history, chat_id,
            ctx.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key
        ), media_type="text/event-stream")

    else:
        refined_context = await crag_refiner.refine(
            ctx.query, "CORRECT", ctx.good_docs,
            openai_api_key=x_openai_api_key, gemini_api_key=x_gemini_api_key
        )
        citations_for_stream = ctx.good_docs

        if not refined_context:
            async def canned_generator():
                msg = "I don't have enough relevant information in your documents to answer this confidently, and you chose not to search the web. Try rephrasing your question or uploading a relevant document."
                yield f"data: {{\"event\": \"citations\", \"data\": {json.dumps(citations_for_stream)}}}\n\n"
                yield f"data: {json.dumps(msg)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(canned_generator(), media_type="text/event-stream")

        return StreamingResponse(_stream_final_answer(
            ctx.query, [refined_context], citations_for_stream, ctx.history, chat_id,
            ctx.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
            conservative=True
        ), media_type="text/event-stream")
