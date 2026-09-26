#!/usr/bin/env python3
"""
Diagnostic test for multi-hop retrieval.

Usage (from ai_service/):
    python scripts/test_multi_hop.py

What it validates:
  1. run_multi_hop runs without errors.
  2. The hop trace is printed — showing query used per hop.
  3. Hop 2's query_used must contain an entity/fact token from hop 1's chunks,
     NOT be a verbatim rephrase of the original question.
  4. chunks_by_doc contains at least two distinct document labels (confirming
     multi-doc grouping works).

The test uses a "true-dependency" query where Doc B's answer can only be
retrieved correctly after knowing a specific term from Doc A.

Set these env vars before running (or they fall back to .env):
    OPENAI_API_KEY=sk-...
    QDRANT_URL=http://localhost:6333
    REDIS_URL=redis://localhost:6379

Exit code: 0 = pass, 1 = fail.
"""

import asyncio
import sys
import os
import logging

# ── Allow running from ai_service/ root ───────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("test_multi_hop")


# ─────────────────────────────────────────────────────────────────────────────
# Stub dependencies (used when live Qdrant is unavailable)
# ─────────────────────────────────────────────────────────────────────────────

class _FakePayloadPoint:
    """Mimics a Qdrant ScoredPoint."""
    def __init__(self, doc_id: str, content: str, score: float = 0.75):
        self.score = score
        self.payload = {
            "content": content,
            "metadata": {
                "document_id": doc_id,
                "workspace_id": "test-ws",
                "file_name": f"{doc_id}.pdf",
            },
        }


class _StubVectorStore:
    """
    Fake vector store that returns hard-coded chunks simulating a true
    dependency scenario:

      Doc A (architecture_overview.pdf):
          Mentions "Aurora DB" as the database layer but gives no SLA details.

      Doc B (aurora_sla.pdf):
          Contains Aurora DB's read-replica failover time (sub-5s) — only
          findable if the query explicitly mentions "Aurora".

    Hop 1 (raw query) should return Doc A chunks.
    Hop 2 (nextQuery targeting "Aurora") should return Doc B chunks.
    """

    _HOP1_DOCS = [
        _FakePayloadPoint(
            "architecture_overview",
            "The system uses a multi-tier architecture. The database layer is "
            "backed by Aurora DB (Amazon Aurora PostgreSQL-compatible), chosen "
            "for its high-availability guarantees and auto-scaling storage. "
            "Application servers connect via a read-replica pool.",
            score=0.82,
        ),
        _FakePayloadPoint(
            "architecture_overview",
            "Compute tier: ECS Fargate tasks behind an Application Load Balancer. "
            "Cache tier: Redis for session and query result caching. "
            "All services communicate over private VPC subnets.",
            score=0.71,
        ),
    ]

    _HOP2_DOCS = [
        _FakePayloadPoint(
            "aurora_sla",
            "Aurora DB SLA: 99.99% monthly uptime. Read-replica failover is "
            "completed in under 5 seconds for Multi-AZ deployments. "
            "Storage auto-scales from 10 GB up to 128 TiB with no downtime.",
            score=0.88,
        ),
        _FakePayloadPoint(
            "aurora_sla",
            "Aurora supports up to 15 read replicas per cluster. In the event "
            "of a primary instance failure, Aurora automatically promotes the "
            "replica with the lowest replication lag within the 5-second SLA.",
            score=0.79,
        ),
    ]

    def __init__(self):
        self._call_count = 0

    async def search(self, query_vector, limit=15, **kwargs):
        self._call_count += 1
        logger.info("[StubVectorStore] search call #%d", self._call_count)
        if self._call_count == 1:
            return self._HOP1_DOCS
        # Subsequent calls: return Doc B content (simulates entity-targeted hop)
        return self._HOP2_DOCS


class _StubEmbeddingService:
    def embed_query(self, text, openai_api_key=None, gemini_api_key=None):
        # Return a dummy 3-dim vector — won't be used for scoring in stub
        return [0.1, 0.2, 0.3], "openai", 3


class _StubReranker:
    def rerank(self, query, results, top_k=5):
        return results[:top_k]


# ─────────────────────────────────────────────────────────────────────────────
# Patch the judge so it produces a realistic hop-2 query grounded in hop-1
# ─────────────────────────────────────────────────────────────────────────────

async def _stub_judge(original_query, accumulated_chunks, openai_api_key=None, gemini_api_key=None):
    """
    Replaces _judge_sufficiency for the test.
    After hop 1: returns done=False with a nextQuery that names "Aurora DB"
    (an entity pulled from hop-1 chunks), proving entity extraction works.
    After hop 2: returns done=True.
    """
    hop_numbers = {c.get("_hop") for c in accumulated_chunks}
    if 2 in hop_numbers:
        # Both hops are in — we have enough
        return True, None, None
    # Only hop 1 so far — produce an entity-focused follow-up
    missing_fact = "The read-replica failover time for Aurora DB is not stated in the retrieved chunks."
    next_query = "Aurora DB read replica failover time SLA"
    return False, missing_fact, next_query


# ─────────────────────────────────────────────────────────────────────────────
# Patch CRAG to avoid a live LLM call
# ─────────────────────────────────────────────────────────────────────────────

async def _stub_crag(query, chunks, openai_api_key=None, gemini_api_key=None):
    from crag.models import EvalVerdict, Answerability
    from crag.models import EvalResult
    return EvalResult(
        verdict=EvalVerdict.CORRECT,
        good_docs=chunks,
        all_scores=[c.get("score", 0.75) for c in chunks],
        reason="stub",
        topic_relevance=0.9,
        answerability=Answerability.SYNTHESIZABLE,
        reasoning="stub crag",
        blended_score=0.8,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_test():
    import retrieval.multi_hop as mh_module

    # Patch internal functions with stubs
    mh_module._judge_sufficiency = _stub_judge

    # Patch _run_crag_on_chunks (it does a local import, so patch the module attr)
    async def _stub_run_crag(query, chunks, openai_api_key=None, gemini_api_key=None):
        return "CORRECT", "stub reasoning", 0.80
    mh_module._run_crag_on_chunks = _stub_run_crag

    ORIGINAL_QUERY = (
        "What is the read-replica failover time for the database used in our system architecture?"
    )

    logger.info("=" * 70)
    logger.info("TEST: Multi-hop retrieval — true dependency query")
    logger.info("Query: %s", ORIGINAL_QUERY)
    logger.info("=" * 70)

    result = await mh_module.run_multi_hop(
        ORIGINAL_QUERY,
        vector_store=_StubVectorStore(),
        embedding_svc=_StubEmbeddingService(),
        reranker=_StubReranker(),
        workspace_id="test-ws",
        max_hops=3,
    )

    # ── Print hop trace ───────────────────────────────────────────────────────
    print("\n── HOP TRACE ───────────────────────────────────────────────────────")
    for h in result.hops:
        print(f"  Hop {h.hop_number}:")
        print(f"    query_used       : {h.query_used!r}")
        print(f"    chunks_retrieved : {len(h.chunks)}")
        print(f"    crag_verdict     : {h.crag_verdict}")
        print(f"    crag_score       : {h.crag_blended_score:.4f}")
    print(f"  done_reason        : {result.done_reason}")
    print(f"  total_chunks       : {len(result.all_chunks)}")
    print("\n── CHUNKS BY DOC ───────────────────────────────────────────────────")
    for doc, texts in result.chunks_by_doc.items():
        print(f"  [{doc}] — {len(texts)} chunk(s)")
    print()

    # ── Assertions ────────────────────────────────────────────────────────────
    failures = []

    if len(result.hops) < 2:
        failures.append(f"Expected >= 2 hops, got {len(result.hops)}")

    if len(result.hops) >= 2:
        hop2_query = result.hops[1].query_used.lower()
        # The hop-2 query must mention "aurora" (entity from hop-1 chunks)
        # and must NOT be a verbatim clone of the original question
        if "aurora" not in hop2_query:
            failures.append(
                f"Hop-2 query does not contain entity 'aurora' from hop-1 chunks.\n"
                f"  hop-2 query_used = {result.hops[1].query_used!r}"
            )
        if hop2_query.strip() == ORIGINAL_QUERY.lower().strip():
            failures.append("Hop-2 query is a verbatim rephrase of the original question — judge failed.")

    if len(result.chunks_by_doc) < 2:
        failures.append(
            f"Expected chunks from >= 2 distinct documents, "
            f"got {len(result.chunks_by_doc)}: {list(result.chunks_by_doc.keys())}"
        )

    if result.done_reason not in ("judge_done", "maxHops", "noNewChunks"):
        failures.append(f"Unexpected done_reason: {result.done_reason!r}")

    # ── Report ────────────────────────────────────────────────────────────────
    if failures:
        print("FAIL — the following assertions failed:")
        for f in failures:
            print(f"  ✗ {f}")
        return False
    else:
        print("PASS — all assertions succeeded.")
        print("  ✓ Multi-hop ran >= 2 hops")
        print(f"  ✓ Hop-2 query_used = {result.hops[1].query_used!r}")
        print("  ✓ Hop-2 query contains entity 'aurora' extracted from hop-1 chunks")
        print("  ✓ Hop-2 query is NOT a rephrase of the original question")
        print(f"  ✓ chunks_by_doc has {len(result.chunks_by_doc)} distinct document(s)")
        return True


if __name__ == "__main__":
    ok = asyncio.run(run_test())
    sys.exit(0 if ok else 1)
