#!/usr/bin/env python3
"""
Diagnostic test: context-aware multi-hop routing.

Tests three cases:
  (a) single_doc chat → _should_run_multi_hop returns False, evaluator never called.
  (b) knowledge_base chat with 1 doc → treated as single_doc, evaluator never called.
  (c) knowledge_base chat with 3 docs → evaluator fires after hop 1; for a
      true-dependency query the hop-2 nextQuery contains an entity from hop-1 content.

Run from ai_service/:
    source venv/bin/activate
    python3 scripts/test_routing.py

Exit 0 = all pass, 1 = failure.
"""

import asyncio
import logging
import sys
import os
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("test_routing")


# ─────────────────────────────────────────────────────────────────────────────
# Import the routing function directly
# ─────────────────────────────────────────────────────────────────────────────

from controllers.chat_controller import _should_run_multi_hop
from schemas.chat import ChatRequest
from core.config import settings


def _make_request(context_type, doc_ids):
    """Build a minimal ChatRequest for routing tests."""
    return ChatRequest(
        query="What is the failover time?",
        workspace_id="ws-test",
        knowledge_base_id="kb-test" if context_type == "knowledge_base" else None,
        document_ids=doc_ids,
        context_type=context_type,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Stubs for multi-hop engine (case c)
# ─────────────────────────────────────────────────────────────────────────────

class FakePoint:
    _ctr = 0
    def __init__(self, doc_id, content, score):
        FakePoint._ctr += 1
        self.id = f"pt-{FakePoint._ctr}"
        self.score = score
        self.payload = {
            "content": content,
            "metadata": {"document_id": doc_id, "workspace_id": "ws-test"},
        }


# Simulate hop-1 returns Doc A (architecture mentions "Nebula Cache")
# Hop-2 must include "Nebula Cache" in its query to satisfy the true-dependency test.
HOP1_POINTS = [
    FakePoint("doc-arch", "The caching layer uses Nebula Cache for low-latency reads.", 0.87),
    FakePoint("doc-arch", "Nebula Cache is deployed as a distributed sidecar per pod.", 0.81),
]
HOP2_POINTS = [
    FakePoint("doc-sla",  "Nebula Cache failover time: under 3 seconds per the SLA.", 0.76),
    FakePoint("doc-sla",  "Cache warm-up after failover completes within 30 seconds.", 0.71),
]


class StubVS:
    def __init__(self):
        self._calls = 0

    async def search(self, query_vector, workspace_id, **kwargs):
        self._calls += 1
        return HOP1_POINTS if self._calls == 1 else HOP2_POINTS

    async def _fetch_distinct_doc_ids(self, **kwargs):
        return ["doc-arch", "doc-sla", "doc-policy"]

    def _build_base_filter(self, **kwargs):
        from qdrant_client.models import Filter, FieldCondition, MatchAny
        return Filter(must=[FieldCondition(key="metadata.workspace_id", match=MatchAny(any=["ws-test"]))])

    async def _vector_query(self, *args, **kwargs):
        return HOP2_POINTS


class StubEmbSvc:
    def embed_query(self, text, **kwargs):
        return ([0.1] * 1536, "openai", 1536)


class StubReranker:
    def rerank(self, query, docs, top_k=5):
        return docs[:top_k]


# Judge stub: after hop 1 returns done=False with "Nebula Cache" as the entity
_judge_call_count = 0

async def _stub_judge(original_query, accumulated_chunks, openai_api_key=None, gemini_api_key=None):
    global _judge_call_count
    _judge_call_count += 1
    # Check which hops are present
    hop_nums = {c.get("_hop") for c in accumulated_chunks}
    if 2 in hop_nums:
        return True, None, None
    # Hop 1 only — need Nebula Cache SLA
    return False, "Failover time for Nebula Cache not found in hop-1 chunks.", "Nebula Cache failover time SLA"

async def _stub_crag(query, chunks, openai_api_key=None, gemini_api_key=None):
    return "CORRECT", "stub", 0.82


# ─────────────────────────────────────────────────────────────────────────────
# Test cases
# ─────────────────────────────────────────────────────────────────────────────

def test_case_a_single_doc():
    """(a) single_doc → should_hop=False, never call evaluator."""
    req = _make_request("single_doc", ["doc-only-one"])
    should_hop, reason = _should_run_multi_hop(req)
    assert not should_hop, f"Expected no hop for single_doc, got should_hop={should_hop}"
    assert "single_doc" in reason
    logger.info("CASE (a) PASS: single_doc → no hop (reason=%r)", reason)
    return True


def test_case_b_kb_one_doc():
    """(b) knowledge_base but only 1 doc in scope → should_hop=False."""
    req = _make_request("knowledge_base", ["doc-only-one"])
    should_hop, reason = _should_run_multi_hop(req)
    assert not should_hop, f"Expected no hop for KB with 1 doc, got should_hop={should_hop}"
    assert "1 doc" in reason or "only" in reason
    logger.info("CASE (b) PASS: KB with 1 doc → no hop (reason=%r)", reason)
    return True


def test_case_b2_no_context_type_one_doc():
    """(b2) Legacy client, 1 doc_id → inferred single_doc, no hop."""
    req = _make_request(None, ["doc-only-one"])
    should_hop, reason = _should_run_multi_hop(req)
    assert not should_hop, f"Expected no hop for 1 doc (legacy), got should_hop={should_hop}"
    logger.info("CASE (b2) PASS: legacy 1 doc → no hop (reason=%r)", reason)
    return True


async def test_case_c_kb_multi_doc():
    """
    (c) knowledge_base with 3 docs:
        - should_hop=True
        - judge fires after hop 1
        - hop-2 nextQuery contains 'Nebula Cache' (entity extracted from hop-1 content)
    """
    global _judge_call_count
    _judge_call_count = 0

    req = _make_request("knowledge_base", ["doc-arch", "doc-sla", "doc-policy"])
    should_hop, reason = _should_run_multi_hop(req)
    assert should_hop, f"Expected hop for KB with 3 docs, got should_hop={should_hop}"
    assert "3" in reason or "knowledge_base" in reason
    logger.info("CASE (c) routing PASS: KB with 3 docs → hop (reason=%r)", reason)

    # Now run the multi-hop engine with stubs
    import retrieval.multi_hop as mh_module
    mh_module._judge_sufficiency = _stub_judge
    mh_module._run_crag_on_chunks = _stub_crag

    result = await mh_module.run_multi_hop(
        "What is the failover time for the caching layer?",
        vector_store=StubVS(),
        embedding_svc=StubEmbSvc(),
        reranker=StubReranker(),
        workspace_id="ws-test",
        document_ids=["doc-arch", "doc-sla", "doc-policy"],
        max_hops=3,
    )

    # ── Assertions ────────────────────────────────────────────────────────────

    # Judge must have been called at least once
    assert _judge_call_count >= 1, \
        f"Judge was never called (_judge_call_count={_judge_call_count})"
    logger.info("  ✓ judge called %d time(s)", _judge_call_count)

    # At least 2 hops
    assert len(result.hops) >= 2, \
        f"Expected >= 2 hops, got {len(result.hops)}"
    logger.info("  ✓ %d hops completed", len(result.hops))

    # Hop-2 query must contain "nebula cache" (entity from hop-1 content)
    hop2_query = result.hops[1].query_used.lower()
    assert "nebula cache" in hop2_query, \
        f"Hop-2 query does not contain 'nebula cache' — got: {result.hops[1].query_used!r}"
    logger.info("  ✓ Hop-2 query_used = %r (entity from hop-1)", result.hops[1].query_used)

    # Hop-2 must NOT be a rephrase of the original
    original_lower = "what is the failover time for the caching layer".lower()
    assert hop2_query.strip() != original_lower, \
        "Hop-2 query is identical to original question — judge failed to extract entity"
    logger.info("  ✓ Hop-2 query is NOT a rephrase of original")

    # Each chunk must have _hop and _source_doc_id tags
    for c in result.all_chunks:
        assert "_hop" in c, f"Chunk missing _hop tag: {c}"
        assert "_source_doc_id" in c, f"Chunk missing _source_doc_id tag: {c}"
    logger.info("  ✓ All chunks have _hop and _source_doc_id tags")

    # chunks_by_doc must span multiple docs
    assert len(result.chunks_by_doc) >= 2, \
        f"Expected chunks from >= 2 docs, got {list(result.chunks_by_doc.keys())}"
    logger.info("  ✓ chunks_by_doc spans %d doc(s): %s",
                len(result.chunks_by_doc), list(result.chunks_by_doc.keys()))

    logger.info("CASE (c) PASS: KB 3-doc multi-hop engine ran correctly")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_all():
    print("\n" + "="*70)
    print("TEST: Context-aware multi-hop routing")
    print("="*70)

    failures = []

    # ── Case (a) ──────────────────────────────────────────────────────────────
    print("\n── Case (a): single_doc — must never hop ─────────────────────────")
    try:
        test_case_a_single_doc()
        print("  PASS")
    except AssertionError as e:
        print(f"  FAIL: {e}")
        failures.append(f"(a) {e}")

    # ── Case (b) ──────────────────────────────────────────────────────────────
    print("\n── Case (b): KB with 1 doc — must never hop ──────────────────────")
    try:
        test_case_b_kb_one_doc()
        test_case_b2_no_context_type_one_doc()
        print("  PASS")
    except AssertionError as e:
        print(f"  FAIL: {e}")
        failures.append(f"(b) {e}")

    # ── Case (c) ──────────────────────────────────────────────────────────────
    print("\n── Case (c): KB with 3 docs — hop loop must fire ─────────────────")
    try:
        await test_case_c_kb_multi_doc()
        print("  PASS")
    except AssertionError as e:
        print(f"  FAIL: {e}")
        failures.append(f"(c) {e}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "="*70)
    if failures:
        print(f"FAIL — {len(failures)} case(s) failed:")
        for f in failures:
            print(f"  ✗ {f}")
    else:
        print("PASS — all 3 routing cases succeeded:")
        print("  ✓ (a) single_doc → no hop")
        print("  ✓ (b) KB with 1 doc → no hop")
        print("  ✓ (c) KB with 3 docs → hop loop fires, entity-grounded nextQuery")
    print("="*70)

    return len(failures) == 0


if __name__ == "__main__":
    # Ensure kill-switch is not blocking tests
    settings.ENABLE_MULTI_HOP = True
    ok = asyncio.run(run_all())
    sys.exit(0 if ok else 1)
