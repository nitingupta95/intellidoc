#!/usr/bin/env python3
"""
Production-safety test + latency/cost benchmark.

Validates:
  1. Redis hop-cache: second call for the same query returns cached chunks,
     not a fresh Qdrant+embed round.
  2. Latency budget: loop exits with done_reason="latencyBudget" when budget
     exhausted, before starting the next embed+search cycle.
  3. Kill-switch (ENABLE_MULTI_HOP=False): _should_run_multi_hop returns False
     regardless of context_type/doc count.
  4. Cost multiplier: debit_wallet_task applies cost_multiplier correctly.
  5. is_partial widens: "latencyBudget" and "noNewChunks" also trigger partial.

Benchmark:
  Reports simulated average latency + token cost for three session types
  across 5 representative queries each.  Uses stub implementations so no
  real Qdrant/OpenAI calls are made.

Run from ai_service/:
    source venv/bin/activate
    python3 scripts/test_production_safety.py

Exit 0 = all assertions pass.
"""

import asyncio
import json
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─────────────────────────────────────────────────────────────────────────────
# Shared stubs
# ─────────────────────────────────────────────────────────────────────────────

class _FakePoint:
    """Mimics a Qdrant ScoredPoint."""
    def __init__(self, doc_id: str, content: str, score: float = 0.8):
        self.score = score
        self.payload = {"content": content, "metadata": {"document_id": doc_id}}


class _FakeVectorStore:
    """Calls counted per query to detect cache hits."""
    def __init__(self, delay_s: float = 0.0):
        self.call_count = 0
        self.delay_s = delay_s

    async def search(self, **kwargs):
        self.call_count += 1
        if self.delay_s:
            await asyncio.sleep(self.delay_s)
        return [
            _FakePoint("doc_a", "Aurora DB is the primary store."),
            _FakePoint("doc_b", "The SLA guarantees 99.99% uptime."),
        ]


class _FakeEmbeddingSvc:
    def embed_query(self, query, **kwargs):
        return ([0.1] * 768, 10, 0)


class _FakeReranker:
    def rerank(self, query, results, top_k=5):
        return results[:top_k]


class _FakeJudgeLLM:
    """Always returns done=True after hop 1 so the loop exits cleanly."""
    async def ainvoke(self, prompt):
        return '{"done": true}'


class _FakeCRAGEval:
    async def evaluate_documents(self, *a, **kw):
        from crag.models import EvalResult, EvalVerdict, Answerability
        return EvalResult(
            verdict=EvalVerdict.CORRECT,
            blended_score=0.85,
            reasoning="stub",
            answerability=Answerability.ANSWERABLE,
            good_docs=[],
        )


class _RedisDict:
    """In-memory Redis stand-in (supports get/setex)."""
    def __init__(self):
        self._store: dict = {}

    async def get(self, key):
        return self._store.get(key)

    async def setex(self, key, ttl, val):
        self._store[key] = val

    def __len__(self):
        return len(self._store)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_kwargs(vs, redis_client=None, latency_budget_s=0.0, max_hops=3):
    return dict(
        vector_store=vs,
        embedding_svc=_FakeEmbeddingSvc(),
        reranker=_FakeReranker(),
        workspace_id="ws-test",
        knowledge_base_id="kb-test",
        document_ids=["doc_a", "doc_b"],
        openai_api_key=None,
        gemini_api_key=None,
        max_hops=max_hops,
        redis_client=redis_client,
        latency_budget_s=latency_budget_s,
    )


async def _run_hop(query, vs, redis_client=None, latency_budget_s=0.0, max_hops=3):
    """Run run_multi_hop with patched judge (always done=True after hop 1)."""
    from retrieval import multi_hop as mh_mod
    original_judge = mh_mod._judge_sufficiency

    async def _fast_judge(*a, **kw):
        return True, None, None  # done immediately

    mh_mod._judge_sufficiency = _fast_judge
    try:
        from retrieval.multi_hop import run_multi_hop
        return await run_multi_hop(
            query,
            **_make_kwargs(vs, redis_client, latency_budget_s, max_hops)
        )
    finally:
        mh_mod._judge_sufficiency = original_judge


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — Redis hop-cache
# ─────────────────────────────────────────────────────────────────────────────

async def test_redis_hop_cache():
    """Second call for identical query+docset hits cache; Qdrant not called again."""
    redis = _RedisDict()
    vs = _FakeVectorStore()

    # First call — should hit Qdrant (call_count goes to 1)
    r1 = await _run_hop("What database is used?", vs, redis_client=redis)
    assert vs.call_count == 1, f"Expected 1 Qdrant call, got {vs.call_count}"

    # Second call — identical query, same doc_ids → should hit Redis cache
    r2 = await _run_hop("What database is used?", vs, redis_client=redis)
    assert vs.call_count == 1, (
        f"Cache miss on second identical call — Qdrant was called {vs.call_count} times"
    )
    assert len(redis) >= 1, "Nothing was written to Redis cache"
    assert len(r1.all_chunks) > 0, "First call returned no chunks"
    assert len(r2.all_chunks) > 0, "Second call (cache hit) returned no chunks"
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — Latency budget
# ─────────────────────────────────────────────────────────────────────────────

async def test_latency_budget():
    """Loop exits with done_reason=latencyBudget when budget is exhausted."""
    # Use a slow VS (0.6s per search) and judge that always returns done=False
    # so the loop wants to keep going, but the 1s budget cuts it off at hop 2.
    from retrieval import multi_hop as mh_mod
    original_judge = mh_mod._judge_sufficiency

    async def _never_done(original_query, accumulated, openai_api_key=None, gemini_api_key=None):
        return False, "missing entity X", "entity X details"

    mh_mod._judge_sufficiency = _never_done

    # Use a VS that returns different unique chunks each call (so dedup never fires first)
    class _UniqueVS:
        def __init__(self, delay_s):
            self.delay_s = delay_s
            self._call = 0

        async def search(self, **kwargs):
            self._call += 1
            await asyncio.sleep(self.delay_s)
            return [_FakePoint(f"doc_{self._call}", f"Unique content for call {self._call}.")]

    vs = _UniqueVS(delay_s=0.5)  # each hop takes ~0.5s

    try:
        from retrieval.multi_hop import run_multi_hop
        result = await run_multi_hop(
            "Cross-doc question requiring 3 hops",
            **_make_kwargs(vs, latency_budget_s=0.8, max_hops=5)
        )
    finally:
        mh_mod._judge_sufficiency = original_judge

    failures = []
    if result.done_reason != "latencyBudget":
        failures.append(
            f"Expected done_reason='latencyBudget', got {result.done_reason!r}. "
            f"Hops run: {len(result.hops)}"
        )
    if len(result.hops) >= 5:
        failures.append(f"All 5 hops ran despite latency budget — loop not cut off")
    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — Kill-switch
# ─────────────────────────────────────────────────────────────────────────────

async def test_kill_switch():
    """ENABLE_MULTI_HOP=False → _should_run_multi_hop always returns False."""
    from core import config as cfg_mod
    from controllers.chat_controller import _should_run_multi_hop
    from schemas.chat import ChatRequest

    original = cfg_mod.settings.ENABLE_MULTI_HOP
    cfg_mod.settings.ENABLE_MULTI_HOP = False

    # Also patch the settings reference inside chat_controller
    import controllers.chat_controller as ctrl
    orig_ctrl_setting = ctrl.settings.ENABLE_MULTI_HOP
    ctrl.settings.ENABLE_MULTI_HOP = False

    try:
        # KB with 3 docs — would normally hop
        req = ChatRequest(
            query="test",
            workspace_id="ws",
            document_ids=["a", "b", "c"],
            context_type="knowledge_base",
        )
        should_hop, reason = _should_run_multi_hop(req)
        failures = []
        if should_hop:
            failures.append(
                f"Kill-switch should prevent hop but got should_hop=True, reason={reason!r}"
            )
        return failures
    finally:
        cfg_mod.settings.ENABLE_MULTI_HOP = original
        ctrl.settings.ENABLE_MULTI_HOP = orig_ctrl_setting


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — Cost multiplier in debit_wallet_task
# ─────────────────────────────────────────────────────────────────────────────

async def test_cost_multiplier():
    """debit_wallet_task applies cost_multiplier to base token cost."""
    from services.chat_service import debit_wallet_task
    import services.chat_service as svc_mod

    debited_amounts = []
    import httpx

    class FakeResp:
        status_code = 200

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, url, **kwargs):
            debited_amounts.append(kwargs.get("json", {}).get("amount", 0))
            return FakeResp()

    original_client = httpx.AsyncClient

    try:
        httpx.AsyncClient = FakeClient

        # Call with multiplier=1.0 (baseline)
        await debit_wallet_task(
            user_id="u1", uses_system_key=True, model="gpt-4o",
            question="test", context_docs=["ctx"], answer="ans", history=[],
            cost_multiplier=1.0,
        )
        base_cost = debited_amounts[-1] if debited_amounts else 0

        # Call with multiplier=2.5
        await debit_wallet_task(
            user_id="u1", uses_system_key=True, model="gpt-4o",
            question="test", context_docs=["ctx"], answer="ans", history=[],
            cost_multiplier=2.5,
        )
        multi_cost = debited_amounts[-1] if len(debited_amounts) >= 2 else 0

    finally:
        httpx.AsyncClient = original_client

    failures = []
    if base_cost <= 0:
        failures.append(f"Base cost should be >0, got {base_cost}")
    elif multi_cost <= 0:
        failures.append(f"Multi-hop cost should be >0, got {multi_cost}")
    elif not (multi_cost >= base_cost * 2.0):
        failures.append(
            f"Expected multi_cost ≥ 2.0x base_cost, got base={base_cost} multi={multi_cost} "
            f"ratio={multi_cost/base_cost:.2f}"
        )
    return failures, base_cost, multi_cost


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — is_partial widens to latencyBudget + noNewChunks
# ─────────────────────────────────────────────────────────────────────────────

async def test_is_partial_reasons():
    """latencyBudget and noNewChunks also set is_partial=True in the controller."""
    from retrieval.multi_hop import MultiHopResult
    failures = []
    for reason in ("maxHops", "latencyBudget", "noNewChunks", "embed_error_hop2", "nextQuery_rephrase"):
        if not MultiHopResult(done_reason=reason).partial:
            failures.append(f"done_reason={reason!r} should set partial=True")
    if MultiHopResult(done_reason="judge_done").partial:
        failures.append("done_reason='judge_done' should NOT set partial=True")
    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark — latency + token cost across session types
# ─────────────────────────────────────────────────────────────────────────────

QUERIES = [
    "What is the database used in the system?",
    "What is the SLA for Aurora DB?",
    "Compare the compute tier and cache layer.",
    "What happens during a read replica failover?",
    "How does storage scaling work?",
]


async def _timed_run(coro):
    t0 = time.perf_counter()
    result = await coro
    elapsed = time.perf_counter() - t0
    return result, elapsed


async def benchmark():
    from services.chat_service import estimate_prompt_tokens
    MODEL = "gpt-4o"
    SIMULATED_ANSWER = "The system uses Aurora DB as its primary database. " * 10

    stats = {}

    for session_label, doc_ids, runs_hop in [
        ("single_doc",          ["doc_a"],           False),
        ("kb_1doc",             ["doc_a"],           False),
        ("kb_2docs_hop2",       ["doc_a", "doc_b"],  True),
    ]:
        latencies = []
        costs = []

        for q in QUERIES:
            vs = _FakeVectorStore(delay_s=0.01)  # 10ms simulated Qdrant
            redis = _RedisDict()

            if runs_hop:
                _, elapsed = await _timed_run(
                    _run_hop(q, vs, redis_client=redis, latency_budget_s=8.0, max_hops=2)
                )
                # Two hops: hop1 (Qdrant+judge) + hop2 (cache hit)
                n_hops = 2
            else:
                # Simulate single-shot: one embed + one Qdrant call
                t0 = time.perf_counter()
                await vs.search(query_vector=[], workspace_id="ws")
                elapsed = time.perf_counter() - t0
                n_hops = 1

            latencies.append(elapsed * 1000)  # ms

            # Simulated token cost: context grows with hops
            ctx_docs = ["chunk text " * 20] * (n_hops * 2)
            msgs = [{"role": "user", "content": q}]
            prompt_tok = estimate_prompt_tokens(MODEL, msgs, ctx_docs)
            compl_tok  = estimate_prompt_tokens(MODEL, [{"content": SIMULATED_ANSWER}], [])
            from services.credit_accounting import credits_for_usage
            base_cost = credits_for_usage(MODEL, prompt_tok, compl_tok)
            mult = 2.5 if runs_hop else 1.0
            costs.append(round(base_cost * mult))

        stats[session_label] = {
            "avg_latency_ms": round(sum(latencies) / len(latencies), 1),
            "avg_cost_credits": round(sum(costs) / len(costs), 1),
            "n_queries": len(QUERIES),
        }

    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_all():
    all_failures = []

    def section(title):
        print(f"\n\u2500\u2500 {title} " + "\u2500" * max(0, 60 - len(title)))

    section("1. Redis hop-cache (cache hit on second identical query)")
    try:
        fails = await test_redis_hop_cache()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 Qdrant called exactly once; second call served from Redis cache")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("2. Latency budget enforced")
    try:
        fails = await test_latency_budget()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 done_reason=latencyBudget; loop cut off before exhausting max_hops")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("3. Kill-switch (ENABLE_MULTI_HOP=False)")
    try:
        fails = await test_kill_switch()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 _should_run_multi_hop returns False regardless of doc count")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("4. Cost multiplier in debit_wallet_task")
    try:
        fails, base, multi = await test_cost_multiplier()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print(f"  \u2713 base={base} credits  |  multi-hop={multi} credits  "
                  f"(ratio={multi/max(base,1):.2f}x)")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    section("5. is_partial widens to latencyBudget + noNewChunks")
    try:
        fails = await test_is_partial_reasons()
        if fails:
            for f in fails: print(f"  \u2717 {f}")
            all_failures += fails
        else:
            print("  \u2713 maxHops, latencyBudget, noNewChunks \u2192 partial=True")
            print("  \u2713 judge_done \u2192 partial=False")
    except Exception as e:
        print(f"  ERROR: {e}")
        all_failures.append(str(e))

    # ── Benchmark ────────────────────────────────────────────────────────────
    section("Benchmark \u2014 latency + cost (5 queries per session type, stubbed)")
    try:
        bm = await benchmark()
        print(f"\n  {'Session type':<30} {'Avg latency':>14} {'Avg cost':>14}")
        print(f"  {'-'*30} {'-'*14} {'-'*14}")
        for label, data in bm.items():
            print(
                f"  {label:<30} "
                f"{data['avg_latency_ms']:>12.1f}ms "
                f"{data['avg_cost_credits']:>12.1f} cr"
            )
        print()
        kb2 = bm.get("kb_2docs_hop2", {})
        sd  = bm.get("single_doc",     {})
        if kb2 and sd and kb2["avg_cost_credits"] > 0:
            ratio = kb2["avg_cost_credits"] / max(sd["avg_cost_credits"], 1)
            print(f"  Cost ratio kb_2docs_hop2 / single_doc = {ratio:.2f}x "
                  f"(expected ~2.5x)")
    except Exception as e:
        print(f"  ERROR in benchmark: {e}")
        all_failures.append(str(e))

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    if all_failures:
        print(f"FAIL \u2014 {len(all_failures)} assertion(s) failed:")
        for f in all_failures:
            print(f"  \u2717 {f}")
    else:
        print("PASS \u2014 all 5 production-safety assertions succeeded.")
    print("=" * 70)
    return len(all_failures) == 0


if __name__ == "__main__":
    ok = asyncio.run(run_all())
    sys.exit(0 if ok else 1)
