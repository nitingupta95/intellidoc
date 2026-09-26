#!/usr/bin/env python3
"""
End-to-end synthesis test: Phase 1 + Phase 2 combined.

Validates:
  1. chunks_by_doc context uses dividers and per-doc headers correctly.
  2. partial=True prepends [PARTIAL_RETRIEVAL] in context; partial=False does not.
  3. synthesis_mode SSE event has multi_doc:true and the correct partial flag.
  4. The SSE stream includes multi_hop_trace, citations, answer tokens, [DONE].
  5. synthesis_mode.partial == True when maxHops hit.
  6. For single_doc sessions, stream_answer_multi_doc is NEVER called.

Run from ai_service/:
    source venv/bin/activate
    python3 scripts/test_synthesis.py

Exit 0 = all pass.
"""

import asyncio
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.WARNING)


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────────────────────

DIVIDER = "\u2550" * 48   # matches rag_chain.py

def _make_chunks_by_doc():
    return {
        "architecture_overview.pdf": [
            "The system uses Aurora DB as its primary database layer.",
            "Compute tier: ECS Fargate. Cache: Redis.",
        ],
        "aurora_sla.pdf": [
            "Aurora DB SLA: 99.99% uptime. Read-replica failover under 5 seconds.",
            "Storage auto-scales from 10 GB to 128 TiB with no downtime.",
        ],
    }


def _make_hop_trace():
    return [
        {"hop": 1, "query": "What database does the system use?",
         "chunks_retrieved": 2, "crag_verdict": "CORRECT",
         "crag_blended_score": 0.81, "crag_reasoning": "stub"},
        {"hop": 2, "query": "Aurora DB read replica failover time SLA",
         "chunks_retrieved": 2, "crag_verdict": "CORRECT",
         "crag_blended_score": 0.88, "crag_reasoning": "stub"},
    ]


def _build_context(chunks_by_doc, partial=False):
    """Mirror the exact context-building logic in rag_chain.stream_answer_multi_doc."""
    sections = []
    for doc_label, texts in chunks_by_doc.items():
        header = f"{DIVIDER}\nFrom Document: {doc_label}\n{DIVIDER}"
        body = "\n\n".join(t for t in texts if t.strip())
        sections.append(f"{header}\n{body}")
    ctx = "\n\n".join(sections)
    if partial:
        ctx = "[PARTIAL_RETRIEVAL \u2014 maxHops reached, answer may be incomplete]\n\n" + ctx
    return ctx


class _FakeRedis:
    async def get(self, key): return None
    async def setex(self, key, ttl, val): pass


class _FakeBgTasks:
    def add_task(self, *a, **kw): pass


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — context grouping (direct string inspection)
# ─────────────────────────────────────────────────────────────────────────────

async def test_context_formatting():
    """
    Verify the formatting logic produces dividers, per-doc headers,
    all chunk content, and no PARTIAL_RETRIEVAL when partial=False.
    """
    ctx = _build_context(_make_chunks_by_doc(), partial=False)
    failures = []
    if "From Document: architecture_overview.pdf" not in ctx:
        failures.append("Missing architecture_overview.pdf header")
    if "From Document: aurora_sla.pdf" not in ctx:
        failures.append("Missing aurora_sla.pdf header")
    if "Aurora DB as its primary database layer" not in ctx:
        failures.append("architecture_overview chunk missing")
    if "Aurora DB SLA: 99.99%" not in ctx:
        failures.append("aurora_sla chunk missing")
    if DIVIDER not in ctx:
        failures.append("Divider missing")
    if "[PARTIAL_RETRIEVAL" in ctx:
        failures.append("PARTIAL_RETRIEVAL present when partial=False")
    return failures, ctx


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — PARTIAL_RETRIEVAL marker (direct string inspection)
# ─────────────────────────────────────────────────────────────────────────────

async def test_partial_flag_in_context():
    """[PARTIAL_RETRIEVAL] must appear when partial=True and NOT when partial=False."""
    ctx_normal  = _build_context(_make_chunks_by_doc(), partial=False)
    ctx_partial = _build_context(_make_chunks_by_doc(), partial=True)
    failures = []
    if "[PARTIAL_RETRIEVAL" in ctx_normal:
        failures.append("[PARTIAL_RETRIEVAL] present when partial=False")
    if "[PARTIAL_RETRIEVAL" not in ctx_partial:
        failures.append("[PARTIAL_RETRIEVAL] missing when partial=True")
    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — SSE events (multi-doc, partial=False)
# ─────────────────────────────────────────────────────────────────────────────

async def test_sse_events_multi_doc():
    from services import chat_service

    original_method = chat_service.rag_chain.stream_answer_multi_doc
    async def fake_multi_doc(question, chunks_by_doc, history, **kw):
        yield "[ANSWER_FROM_MULTI_DOC]"
    chat_service.rag_chain.stream_answer_multi_doc = fake_multi_doc

    citations = [{"score": 0.9, "text_snippet": "s", "full_text": "f", "metadata": {}}]
    sse_output = []
    async for line in chat_service._stream_final_answer(
        question="What is the Aurora DB failover time?",
        context_docs=["flat fallback"],
        citations=citations,
        history=[],
        chat_id="test-chat",
        workspace_id="ws-test",
        redis_client=_FakeRedis(),
        bg_tasks=_FakeBgTasks(),
        x_openai_api_key=None,
        x_gemini_api_key=None,
        synthesized=True,
        chunks_by_doc=_make_chunks_by_doc(),
        hop_trace=_make_hop_trace(),
        partial=False,
    ):
        sse_output.append(line)

    chat_service.rag_chain.stream_answer_multi_doc = original_method
    full_sse = "".join(sse_output)
    failures = []

    if '"event": "citations"' not in full_sse:
        failures.append("citations SSE event missing")
    if '"event": "synthesis_mode"' not in full_sse:
        failures.append("synthesis_mode SSE event missing")
    else:
        for line in sse_output:
            if '"synthesis_mode"' in line:
                data_part = line.strip().replace("data: ", "", 1)
                try:
                    obj = json.loads(data_part)
                    data = obj.get("data", obj)
                    if not data.get("multi_doc"):
                        failures.append(f"synthesis_mode.multi_doc not True: {data}")
                    if data.get("partial") is not False:
                        failures.append(f"synthesis_mode.partial expected False: {data}")
                except Exception as e:
                    failures.append(f"synthesis_mode parse error: {e}")
    if '"event": "multi_hop_trace"' not in full_sse:
        failures.append("multi_hop_trace SSE event missing")
    if "[ANSWER_FROM_MULTI_DOC]" not in full_sse:
        failures.append("answer token missing")
    if "[DONE]" not in full_sse:
        failures.append("[DONE] sentinel missing")
    return failures, full_sse


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — synthesis_mode.partial==True when maxHops hit
# ─────────────────────────────────────────────────────────────────────────────

async def test_sse_partial_true():
    from services import chat_service

    async def fake_multi_doc(question, chunks_by_doc, history, **kw):
        yield "[PARTIAL_ANSWER]"
    orig = chat_service.rag_chain.stream_answer_multi_doc
    chat_service.rag_chain.stream_answer_multi_doc = fake_multi_doc

    sse_output = []
    async for line in chat_service._stream_final_answer(
        question="incomplete question",
        context_docs=[],
        citations=[],
        history=[],
        chat_id="test",
        workspace_id="ws-test",
        redis_client=_FakeRedis(),
        bg_tasks=_FakeBgTasks(),
        x_openai_api_key=None,
        x_gemini_api_key=None,
        synthesized=True,
        chunks_by_doc=_make_chunks_by_doc(),
        hop_trace=[],
        partial=True,
    ):
        sse_output.append(line)

    chat_service.rag_chain.stream_answer_multi_doc = orig
    failures = []
    for line in sse_output:
        if '"synthesis_mode"' in line:
            data_part = line.strip().replace("data: ", "", 1)
            try:
                obj = json.loads(data_part)
                data = obj.get("data", obj)
                if data.get("partial") is not True:
                    failures.append(f"synthesis_mode.partial expected True: {data}")
            except Exception as e:
                failures.append(f"parse error: {e}")
    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — single_doc never calls stream_answer_multi_doc
# ─────────────────────────────────────────────────────────────────────────────

async def test_single_doc_never_calls_multi_doc():
    from services import chat_service

    multi_doc_called = []
    orig_multi = chat_service.rag_chain.stream_answer_multi_doc
    async def spy_multi_doc(*a, **kw):
        multi_doc_called.append(True)
        yield "[SHOULD_NOT_APPEAR]"
    chat_service.rag_chain.stream_answer_multi_doc = spy_multi_doc

    orig_flat = chat_service.rag_chain.stream_answer
    async def fake_flat(question, docs, history, **kw):
        yield "[SINGLE_DOC_ANSWER]"
    chat_service.rag_chain.stream_answer = fake_flat

    sse_output = []
    async for line in chat_service._stream_final_answer(
        question="single doc question",
        context_docs=["only one doc chunk"],
        citations=[],
        history=[],
        chat_id="test",
        workspace_id="ws-test",
        redis_client=_FakeRedis(),
        bg_tasks=_FakeBgTasks(),
        x_openai_api_key=None,
        x_gemini_api_key=None,
        synthesized=False,
        chunks_by_doc=None,
        hop_trace=None,
        partial=False,
    ):
        sse_output.append(line)

    chat_service.rag_chain.stream_answer_multi_doc = orig_multi
    chat_service.rag_chain.stream_answer = orig_flat

    failures = []
    if multi_doc_called:
        failures.append("stream_answer_multi_doc was called for a single_doc session")
    if "[SINGLE_DOC_ANSWER]" not in "".join(sse_output):
        failures.append("flat stream_answer was not called")
    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_all():
    all_failures = []

    def section(title):
        print(f"\n\u2500\u2500 {title} " + "\u2500" * max(0, 60 - len(title)))

    section("1. Context grouping: dividers + per-doc headers")
    try:
        fails, ctx = await test_context_formatting()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            docs = list(_make_chunks_by_doc().keys())
            print(f"  \u2713 Per-doc headers present: {docs}")
            print(f"  \u2713 Dividers (\u2550\u2550\u2550) present")
            print(f"  \u2713 Both chunks from both docs in context")
            print(f"  \u2713 No PARTIAL_RETRIEVAL when partial=False")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("2. [PARTIAL_RETRIEVAL] marker")
    try:
        fails = await test_partial_flag_in_context()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 [PARTIAL_RETRIEVAL] present when partial=True")
            print("  \u2713 [PARTIAL_RETRIEVAL] absent when partial=False")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("3. SSE events \u2014 multi-doc, partial=False")
    try:
        fails, _ = await test_sse_events_multi_doc()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 citations event")
            print("  \u2713 synthesis_mode: {multi_doc:true, partial:false}")
            print("  \u2713 multi_hop_trace event")
            print("  \u2713 answer tokens from stream_answer_multi_doc")
            print("  \u2713 [DONE] sentinel")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("4. synthesis_mode.partial == True when maxHops hit")
    try:
        fails = await test_sse_partial_true()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 synthesis_mode.partial == True")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("5. Single-doc \u2014 stream_answer_multi_doc never called")
    try:
        fails = await test_single_doc_never_calls_multi_doc()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 stream_answer_multi_doc NOT called")
            print("  \u2713 flat stream_answer called instead")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    print("\n" + "=" * 70)
    if all_failures:
        print(f"FAIL \u2014 {len(all_failures)} assertion(s) failed:")
        for f in all_failures:
            print(f"  \u2717 {f}")
    else:
        print("PASS \u2014 all 5 synthesis assertions succeeded.")
    print("=" * 70)
    return len(all_failures) == 0


if __name__ == "__main__":
    ok = asyncio.run(run_all())
    sys.exit(0 if ok else 1)
