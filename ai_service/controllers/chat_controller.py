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
from services.chat_service import _stream_final_answer, system_embedding_credits
from embeddings.embedding_service import EmbeddingService
from retrieval.reranker import reranker
from retrieval.multi_hop import run_multi_hop
from core.dependencies import get_vector_store
from core.config import settings
from crag.models import EvalVerdict, PendingCRAGContext, Answerability
from crag import evaluator as crag_evaluator
from crag import refiner as crag_refiner
from crag import web_search as crag_web_search
from crag import pending_store as crag_pending_store

logger = logging.getLogger(__name__)
embedding_svc = EmbeddingService()


def _should_run_multi_hop(request: "ChatRequest") -> tuple[bool, str]:
    """
    Determine whether the multi-hop retrieval loop should run for this request.

    Rules (applied in order):
      1. Global kill-switch: ENABLE_MULTI_HOP=False → never hop.
      2. context_type == "single_doc" → never hop (user is chatting with one document).
      3. context_type == "knowledge_base" and only 1 document in scope → never hop
         (treat as single_doc even though the route is a KB conversation).
      4. context_type == "knowledge_base" with 2+ documents in scope → hop.
      5. context_type is None (legacy client): infer from document_ids length.
         - 1 or fewer document_ids → no hop.
         - 2+ document_ids → hop.

    Returns (should_hop: bool, reason: str) for logging.
    """
    # Rule 1: global kill-switch
    if not settings.ENABLE_MULTI_HOP:
        return False, "kill-switch ENABLE_MULTI_HOP=False"

    n_docs = len(request.document_ids) if request.document_ids else 0
    ctx = request.context_type  # "single_doc" | "knowledge_base" | None

    # Rule 2: explicit single_doc declaration
    if ctx == "single_doc":
        return False, "context_type=single_doc"

    # Rule 3: KB declared but only 1 doc resolved
    if ctx == "knowledge_base" and n_docs <= 1:
        return False, f"context_type=knowledge_base but only {n_docs} doc(s) in scope"

    # Rule 4: KB with 2+ docs
    if ctx == "knowledge_base" and n_docs >= 2:
        return True, f"context_type=knowledge_base with {n_docs} docs"

    # Rule 5: legacy client — infer from document_ids
    if n_docs >= 2:
        return True, f"inferred multi-doc from {n_docs} document_ids (no context_type)"

    return False, f"inferred single-doc from {n_docs} document_ids (no context_type)"


async def handle_chat_query(
    request: ChatRequest,
    bg_tasks: BackgroundTasks,
    redis_client,
    x_openai_api_key: str,
    x_gemini_api_key: str,
    user: dict,
    fastapi_req=None
):
    try:
        t0 = time.perf_counter()
        logger.error(f"CHAT ENDPOINT REACHED FOR QUERY: {request.query}")

        user_id = fastapi_req.headers.get("x-user-id") if fastapi_req else None
        uses_system_key = fastapi_req.headers.get("x-uses-system-key", "true").lower() == "true" if fastapi_req else False
        model = "gpt-4o"

        # ── Key resolution ────────────────────────────────────────────────────
        # When uses_system_key=true the user has NO stored BYOK keys.
        # Next.js forwards its own OPENAI_API_KEY as a convenience, but that key
        # may have different quota/billing from the AI-service's OPENAI_API_KEY.
        # To avoid "credit_balance_exhausted" on whichever system key happens to
        # be depleted, let the AI service use its OWN settings.OPENAI_API_KEY
        # (which is what document ingestion uses) by passing None here.
        # The EmbeddingService and chat_service already fall back to settings.* when
        # the passed-in key is None.
        if uses_system_key:
            x_openai_api_key = None
            x_gemini_api_key = None
        
        q_hash = hashlib.sha256(request.query.encode()).hexdigest()
        kb_id_str = request.knowledge_base_id or "none"
        # Doc scope + chat history are part of the key: a follow-up like "tell me
        # more" must not replay an answer cached at a different point in a
        # conversation. Hashed so large doc sets don't produce multi-KB keys.
        ctx_hash = hashlib.sha256(json.dumps(
            [sorted(request.document_ids or []), request.history or []], sort_keys=True
        ).encode()).hexdigest()[:32]
        full_resp_key = f"resp:{request.workspace_id}:{kb_id_str}:{ctx_hash}:{q_hash}"

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
                # Documents are indexed with OpenAI embeddings (system key), so queries
                # must be too: the user's OpenAI key if they have one, else the system key.
                vector, prov, d = await asyncio.to_thread(
                    embedding_svc.embed_query, query, openai_api_key=x_openai_api_key or None,
                )
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

        # Route before retrieving so a multi-hop query never pays for a
        # single-shot search it would discard. Summary requests need every
        # chunk, so they never hop.
        if is_summary_request:
            should_hop, hop_reason = False, "summary request"
        else:
            should_hop, hop_reason = _should_run_multi_hop(request)
        logger.info("ROUTING: multi_hop=%s reason=%r", should_hop, hop_reason)

        mh_result = None
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
        elif should_hop:
            mh_result = await run_multi_hop(
                request.query,
                vector_store=vs,
                embedding_svc=embedding_svc,
                reranker=reranker,
                workspace_id=request.workspace_id,
                knowledge_base_id=request.knowledge_base_id,
                document_ids=request.document_ids,
                team_id=request.team_id,
                department=request.department,
                project=request.project,
                openai_api_key=x_openai_api_key,
                gemini_api_key=x_gemini_api_key,
                max_hops=settings.MULTI_HOP_MAX_HOPS,
                redis_client=redis_client,
                latency_budget_s=settings.MULTI_HOP_LATENCY_BUDGET_S,
                query_vector=query_vector,
                document_names=request.document_names,
            )
            search_results = []
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
                project=request.project,
                per_doc_floor=settings.RETRIEVAL_PER_DOC_FLOOR,
                total_cap=settings.RETRIEVAL_TOTAL_CAP,
            )
            logger.info(
                "RETRIEVAL single-shot: returned %d chunks | doc_ids_scope=%s | workspace=%s",
                len(search_results), request.document_ids, request.workspace_id,
            )
            if search_results:
                search_results = reranker.rerank(
                    request.query, search_results, top_k=settings.RETRIEVAL_TOTAL_CAP
                )
                logger.info("RETRIEVAL after MMR rerank: %d chunks", len(search_results))

        retrieved_docs = []
        citations = []
        doc_names = request.document_names or {}
        for res in search_results:
            payload = res.payload or {}
            text = payload.get("content", "")
            meta = payload.get("metadata", {})
            if meta.get("document_id") in doc_names:
                meta = {**meta, "document_name": doc_names[meta["document_id"]]}
            retrieved_docs.append(text)
            citations.append({
                "score": getattr(res, "score", 1.0),
                "text_snippet": text[:150] + "..." if len(text) > 150 else text,
                "full_text": text,
                "metadata": meta,
            })

        if mh_result is not None:
            citations = mh_result.all_chunks
            retrieved_docs = [c.get("full_text", "") for c in citations]

        if not retrieved_docs:
            retrieved_docs = ["No relevant context found in documents."]

        t_search = time.perf_counter() - t_search_start

        # A BYOK user without an OpenAI key had their query (and any follow-up hop
        # queries) embedded on the system key — bill that; key-holders pay their provider.
        embedded_queries = [h.query_used for h in mh_result.hops] if mh_result else [request.query]
        system_credits = (
            system_embedding_credits(embedded_queries)
            if not uses_system_key and not x_openai_api_key else 0
        )

        if is_summary_request:
            # Bypass CRAG completely for whole-document structural summaries
            context_to_use = [" ".join(retrieved_docs)]
            logger.info(f"Bypassing CRAG for summary. Total context length: {len(context_to_use[0])} chars.")
            return StreamingResponse(
                _stream_final_answer(
                    request.query, context_to_use, citations, request.history, chat_id,
                    request.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
                    full_resp_key, t0, t_embed, t_search,
                    synthesized=True,
                    user_id=user_id, uses_system_key=uses_system_key, model=model,
                    system_credits=system_credits,
                ),
                media_type="text/event-stream"
            )

        eval_result = await crag_evaluator.evaluate_documents(
            request.query, citations, x_openai_api_key, x_gemini_api_key
        )

        # ── Multi-hop: CORRECT / AMBIGUOUS → multi-doc synthesis ─────────────
        # (multi-hop INCORRECT falls through to the shared confirm flow below)
        if mh_result is not None and eval_result.verdict in (EvalVerdict.CORRECT, EvalVerdict.AMBIGUOUS):
            hop_trace = [
                {"hop": h.hop_number, "query": h.query_used, "chunks_retrieved": len(h.chunks)}
                for h in mh_result.hops
            ]
            logger.info("MULTI_HOP trace: %s done_reason=%r", hop_trace, mh_result.done_reason)

            # The CRAG refiner flattens context into one string, which would undo
            # the per-doc grouping, so stream_answer_multi_doc formats from
            # chunks_by_doc directly.
            return StreamingResponse(
                _stream_final_answer(
                    request.query, retrieved_docs, eval_result.good_docs or citations, request.history, chat_id,
                    request.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
                    # a best-effort (partial) answer must not be pinned in the response cache
                    full_resp_key=None if mh_result.partial else full_resp_key,
                    t0=t0, t_embed=t_embed, t_search=t_search,
                    synthesized=True,
                    user_id=user_id, uses_system_key=uses_system_key, model=model,
                    system_credits=system_credits,
                    chunks_by_doc=mh_result.chunks_by_doc,
                    hop_trace=hop_trace,
                    partial=mh_result.partial,
                    # only charge the multiplier when extra hops actually ran
                    cost_multiplier=settings.MULTI_HOP_COST_MULTIPLIER if len(mh_result.hops) > 1 else 1.0,
                ),
                media_type="text/event-stream"
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
                    user_id=user_id, uses_system_key=uses_system_key, model=model,
                    system_credits=system_credits,
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
                        user_id=user_id, uses_system_key=uses_system_key, model=model,
                        system_credits=system_credits,
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
    user: dict,
    fastapi_req=None
):
    ctx = await crag_pending_store.load_pending_context(redis_client, request.pending_id)

    if ctx is None:
        return JSONResponse(
            status_code=410,
            content={"error": "This confirmation has expired or was already used. Please ask your question again."}
        )

    user_id = fastapi_req.headers.get("x-user-id") if fastapi_req else None
    uses_system_key = fastapi_req.headers.get("x-uses-system-key", "true").lower() == "true" if fastapi_req else False
    model = "gpt-4o"

    # Same key-resolution fix as handle_chat_query: let the AI service use its
    # own settings.OPENAI_API_KEY rather than a potentially-exhausted forwarded key.
    if uses_system_key:
        x_openai_api_key = None
        x_gemini_api_key = None

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
            
        # Estimate extra tokens used by Web Search pipeline
        # - rewrite_query uses the question
        extra_prompt_tokens = len(ctx.query) // 3.5
        extra_completion_tokens = 15 # rewrite output usually short
        
        # - refine uses query + web docs + good docs
        extra_prompt_tokens += sum([len(w["page_content"]) // 3.5 for w in web_docs])
        extra_prompt_tokens += sum([len(d.get("full_text", "")) // 3.5 for d in ctx.good_docs])
        extra_completion_tokens += 300 # rough estimate for refined context length
        
        return StreamingResponse(_stream_final_answer(
            ctx.query, context_to_use, citations_for_stream, ctx.history, chat_id,
            ctx.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
            user_id=user_id, uses_system_key=uses_system_key, model=model,
            extra_prompt_tokens=int(extra_prompt_tokens),
            extra_completion_tokens=int(extra_completion_tokens),
            did_web_search=True
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

        # Estimate extra tokens for refinement only
        extra_prompt_tokens = sum([len(d.get("full_text", "")) // 3.5 for d in ctx.good_docs])
        extra_completion_tokens = 300
        
        return StreamingResponse(_stream_final_answer(
            ctx.query, [refined_context], citations_for_stream, ctx.history, chat_id,
            ctx.workspace_id, redis_client, bg_tasks, x_openai_api_key, x_gemini_api_key,
            conservative=True,
            user_id=user_id, uses_system_key=uses_system_key, model=model,
            extra_prompt_tokens=int(extra_prompt_tokens),
            extra_completion_tokens=int(extra_completion_tokens)
        ), media_type="text/event-stream")
