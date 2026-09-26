"""
Patch multi_hop.py loop body in-place:
  - Insert latency budget check before each hop
  - Insert Redis cache read before embed+search
  - Wrap embed+search+rerank+cite-dict in an else branch
  - Write to Redis cache after cite-dict build
  - Close else branch before dedup
"""

import re, sys

path = "/Users/nitingupta/Desktop/doc_maanagement/ai_service/retrieval/multi_hop.py"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

# ── Find the for-loop intro line and the dedup section ──────────────────────
# We'll replace from "    for hop_num in range" to "        # ── Deduplicate"
# with a new block that includes latency + cache logic.

OLD = (
    "    for hop_num in range(1, max_hops + 1):\n"
    "        logger.info(\"MULTI_HOP hop=%d query=%r\", hop_num, current_query)\n"
    "\n"
    "        # \u2500\u2500 Embed the current hop query "
)

if OLD not in src:
    # Try plain ascii
    OLD = (
        "    for hop_num in range(1, max_hops + 1):\n"
        "        logger.info(\"MULTI_HOP hop=%d query=%r\", hop_num, current_query)\n"
    )
    print("Warning: first candidate not found, will try partial match")

# Locate the start of the for loop and replace everything up through
# the hop_chunks build section, injecting the new safety blocks.
# We split around the dedup sentinel which hasn't changed.

DEDUP_SENTINEL = "        # \u2500\u2500 Deduplicate vs previous hops"
LOOP_FOR = "    for hop_num in range(1, max_hops + 1):"

assert LOOP_FOR in src, "Cannot find for-loop line"
assert DEDUP_SENTINEL in src, "Cannot find dedup sentinel"

# Everything before the for-loop
before_loop_idx = src.index(LOOP_FOR)
before_loop = src[:before_loop_idx]

# Everything from the dedup sentinel onward
after_cite_idx = src.index(DEDUP_SENTINEL)
after_cite = src[after_cite_idx:]

NEW_LOOP_HEAD = '''\
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

'''

new_src = before_loop + NEW_LOOP_HEAD + after_cite

with open(path, "w", encoding="utf-8") as f:
    f.write(new_src)

print("Patch applied. Lines in file:", new_src.count("\n"))
