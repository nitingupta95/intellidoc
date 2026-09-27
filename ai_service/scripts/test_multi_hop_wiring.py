#!/usr/bin/env python3
"""
Regression checks for the multi-hop wiring (no network, no API keys).

Usage (from ai_service/):
    INTERNAL_SERVICE_SECRET=x python scripts/test_multi_hop_wiring.py

Covers:
  1. Judge + CRAG prompts parse to exactly their real variables (literal JSON
     braces used to be read as template variables, so both LLM calls raised on
     every request and multi-hop never got past hop 1).
  2. Hop 1 reuses the controller's vector and keeps the single-shot budget
     (per-doc floor + RETRIEVAL_TOTAL_CAP); follow-up hops are targeted.
  3. A follow-up embedding with a different dimension stops the loop.
  4. document_names label chunks_by_doc and citation metadata.
  5. The hop cache is scoped by workspace.
  6. Controller: multiplier only when >1 hop ran; partial answers are not cached;
     the response-cache key changes with chat history.
  7. A judge exception ends the loop as partial ("judge_error"), not "judge_done".
  8. Gemini models come from settings; the refiner fails open when every check errors.
  9. Billing: BYOK users pay only for system resources (query embeddings on the
     system key, web search); query embeddings never use a Gemini key; a BYOK
     OpenAI key never falls back to the system Gemini key.
 10. Indexing: embeddings on the uploader's OpenAI key (never Gemini), system-key
     work billed as DEBIT_EMBEDDING / DEBIT_SUMMARY, key lookup failure falls back.

Exit code: 0 = pass, 1 = fail.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("INTERNAL_SERVICE_SECRET", "test")

from core.config import settings
import retrieval.multi_hop as mh


class _Point:
    def __init__(self, doc_id, content, score=0.8):
        self.id = f"{doc_id}:{content[:10]}"
        self.score = score
        self.payload = {"content": content, "metadata": {"document_id": doc_id}}


class _VS:
    collection_name = "documents_openai"

    def __init__(self):
        self.calls = []

    async def search(self, **kw):
        self.calls.append(kw)
        n = len(self.calls)
        return [_Point("doc-a" if n == 1 else "doc-b", f"chunk from search {n} " * 5)]


class _Emb:
    def __init__(self, dim=3):
        self.dim, self.calls, self.gemini_keys = dim, 0, []

    def embed_query(self, text, openai_api_key=None, gemini_api_key=None):
        self.calls += 1
        self.gemini_keys.append(gemini_api_key)
        return [0.1] * self.dim, "openai", self.dim


class _Rerank:
    def __init__(self):
        self.top_ks = []

    def rerank(self, query, docs, top_k=5):
        self.top_ks.append(top_k)
        return docs[:top_k]


class _Redis(dict):
    async def get(self, k):
        return dict.get(self, k)

    async def setex(self, k, ttl, v):
        self[k] = v


async def _judge_once(q, acc, *a):
    return (True, None, None) if len(acc) > 1 else (False, "missing", "Doc B entity lookup")


async def _run(vs, emb, rr, **kw):
    return await mh.run_multi_hop(
        "what links doc a and doc b?", vector_store=vs, embedding_svc=emb, reranker=rr,
        workspace_id=kw.pop("workspace_id", "ws1"), document_ids=["doc-a", "doc-b"],
        query_vector=[0.1, 0.1, 0.1], **kw,
    )


async def main():
    failures = []

    def check(cond, msg):
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            failures.append(msg)

    # 1. prompt variables
    from crag.evaluator import _set_eval_prompt
    check(sorted(mh._judge_prompt.input_variables) == ["chunks_text", "original_query"],
          f"judge prompt vars {mh._judge_prompt.input_variables}")
    check(sorted(_set_eval_prompt.input_variables) == ["chunks_text", "question"],
          f"CRAG prompt vars {_set_eval_prompt.input_variables}")

    mh._judge_sufficiency = _judge_once

    # 2 + 4. hop budgets, vector reuse, names
    vs, emb, rr = _VS(), _Emb(), _Rerank()
    r = await _run(vs, emb, rr, document_names={"doc-a": "Alpha.pdf", "doc-b": "Beta.pdf"})
    check(len(r.hops) == 2 and r.done_reason == "judge_done" and not r.partial,
          f"two hops then judge_done (got {len(r.hops)}, {r.done_reason})")
    check(emb.calls == 1, f"hop 1 reuses controller vector (embed calls={emb.calls})")
    check(vs.calls[0]["per_doc_floor"] == settings.RETRIEVAL_PER_DOC_FLOOR and vs.calls[1]["per_doc_floor"] == 0,
          "per-doc floor on hop 1 only")
    check(rr.top_ks == [settings.RETRIEVAL_TOTAL_CAP, 5], f"rerank top_k per hop {rr.top_ks}")
    check(sorted(r.chunks_by_doc) == ["Alpha.pdf", "Beta.pdf"], f"chunks_by_doc labels {list(r.chunks_by_doc)}")
    check(all(c["metadata"].get("document_name") for c in r.all_chunks), "citations carry document_name")

    # 7. judge exception -> partial, not silently "done"
    async def _judge_boom(q, acc, *a):
        raise RuntimeError("404 model not found")
    mh._judge_sufficiency = _judge_boom
    r = await _run(_VS(), _Emb(), _Rerank())
    check(r.done_reason == "judge_error" and r.partial, f"judge error -> partial ({r.done_reason})")
    mh._judge_sufficiency = _judge_once

    # 3. dim mismatch
    r = await _run(_VS(), _Emb(dim=768), _Rerank())
    check(r.done_reason == "embed_provider_mismatch_hop2" and len(r.hops) == 1,
          f"dim mismatch stops loop ({r.done_reason})")

    # 5. cache scoping
    redis = _Redis()
    await _run(_VS(), _Emb(), _Rerank(), redis_client=redis, workspace_id="ws1")
    vs2 = _VS()
    await _run(vs2, _Emb(), _Rerank(), redis_client=redis, workspace_id="ws2")
    check(len(vs2.calls) == 2, "other workspace does not hit ws1 hop cache")
    vs3 = _VS()
    await _run(vs3, _Emb(), _Rerank(), redis_client=redis, workspace_id="ws1")
    check(len(vs3.calls) == 0, "same scope hits hop cache")

    # 6. controller billing / caching
    import controllers.chat_controller as cc
    from crag.models import EvalResult, EvalVerdict
    from schemas.chat import ChatRequest

    captured = {}

    async def _fake_stream(*a, **kw):
        captured.update(kw)
        yield "data: [DONE]\n\n"

    async def _fake_vs(**kw):
        return _VS()

    async def _fake_eval(q, cits, *a):
        return EvalResult(verdict=EvalVerdict.CORRECT, good_docs=cits, all_scores=[], reason="")

    cc._stream_final_answer, cc.get_vector_store = _fake_stream, _fake_vs
    cc.crag_evaluator.evaluate_documents = _fake_eval
    cc.embedding_svc = _Emb()

    class _Req:
        def __init__(self, byok):
            self.headers = {"x-user-id": "u1", "x-uses-system-key": "false" if byok else "true"}

    async def _ask(judge, history=None, byok=False, openai_key=None, gemini_key=None):
        captured.clear()
        mh._judge_sufficiency = judge
        req = ChatRequest(query="how do alpha and beta relate?", workspace_id="ws9",
                          document_ids=["doc-a", "doc-b"], context_type="knowledge_base",
                          history=history)
        resp = await cc.handle_chat_query(req, None, _Redis(), openai_key, gemini_key, {}, _Req(byok))
        async for _ in resp.body_iterator:
            pass
        return captured

    async def _done_first(q, acc, *a):
        return True, None, None

    kw = await _ask(_done_first)
    check(kw.get("cost_multiplier") == 1.0 and kw.get("full_resp_key"),
          f"single hop: no multiplier, cached (mult={kw.get('cost_multiplier')})")
    key_a = kw.get("full_resp_key")
    key_b = (await _ask(_done_first, history=[{"role": "user", "content": "earlier question"}])).get("full_resp_key")
    check(key_a and key_b and key_a != key_b, "response cache key depends on chat history")

    async def _never_done(q, acc, *a):
        return False, "missing", f"lookup {len(acc)}"

    kw = await _ask(_never_done)
    check(kw.get("cost_multiplier") == settings.MULTI_HOP_COST_MULTIPLIER and kw.get("partial") is True
          and kw.get("full_resp_key") is None,
          f"maxHops: multiplier, partial, not cached (mult={kw.get('cost_multiplier')}, key={kw.get('full_resp_key')})")

    # 9a. controller billing inputs
    cc.embedding_svc = emb9 = _Emb()
    kw = await _ask(_done_first, byok=True, gemini_key="user-gemini")
    check(kw.get("system_credits", 0) >= 1, f"BYOK Gemini-only: system embedding billed ({kw.get('system_credits')})")
    check(all(g is None for g in emb9.gemini_keys), "query embeddings never use a Gemini key")
    kw = await _ask(_done_first, byok=True, openai_key="user-openai")
    check(kw.get("system_credits") == 0, "BYOK with OpenAI key: no system embedding charge")
    kw = await _ask(_done_first, byok=False, openai_key="sys-openai")
    check(kw.get("system_credits") == 0, "system-key user: billed via LLM tokens, not system_credits")

    # 9b. debit amounts
    import httpx
    import services.chat_service as svc
    debits = []

    class _Resp:
        status_code = 200

    class _Client:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, url, **kw):
            debits.append(kw["json"]["amount"])
            return _Resp()

    orig_client, httpx.AsyncClient = httpx.AsyncClient, _Client
    try:
        base = dict(user_id="u1", model="gpt-4o", question="q", context_docs=["ctx " * 200], answer="a " * 200, history=[])
        await svc.debit_wallet_task(uses_system_key=False, system_credits=1, **base)
        await svc.debit_wallet_task(uses_system_key=False, system_credits=0, did_web_search=True, **base)
        await svc.debit_wallet_task(uses_system_key=False, system_credits=0, **base)
        await svc.debit_wallet_task(uses_system_key=True, **base)
    finally:
        httpx.AsyncClient = orig_client
    web = svc.CREDIT_RATES["web-search"]["perRequest"]
    check(debits[:2] == [1, web], f"BYOK billed system resources only (got {debits[:2]})")
    check(len(debits) == 3 and debits[2] > 1, f"BYOK with no system usage not billed; system-key LLM billed ({debits})")

    # 9c. rag_chain fallback never uses the system Gemini key for a BYOK OpenAI user
    from llm.rag_chain import RAGChain
    orig_key, settings.GEMINI_API_KEY = settings.GEMINI_API_KEY, "system-gemini"
    try:
        rc = RAGChain()
        check(rc._get_fallback_llm(None, "user-openai") is None, "BYOK OpenAI quota: no system Gemini fallback")
        check(rc._get_fallback_llm(None, None) is not None, "system request: system Gemini fallback kept")
    finally:
        settings.GEMINI_API_KEY = orig_key

    # 10. document indexing billing + key selection
    import services.document_service as ds
    billed = []

    async def _fake_debit(user_id, amount, tx_type, metadata):
        billed.append((tx_type, amount))
        return True

    orig_debit, ds.debit_credits = ds.debit_credits, _fake_debit
    try:
        texts = ["chunk text " * 50] * 4
        summary = {"summary": "A summary.", "suggestedQuestions": ["Q?"]}
        await ds._bill_indexing("u1", "d1", texts, texts[0], summary, None, None)
        check([t for t, _ in billed] == ["DEBIT_EMBEDDING", "DEBIT_SUMMARY"] and all(a >= 1 for _, a in billed),
              f"system-key indexing bills embeddings + summary ({billed})")
        billed.clear()
        await ds._bill_indexing("u1", "d1", texts, texts[0], summary, None, "user-gemini")
        check([t for t, _ in billed] == ["DEBIT_EMBEDDING"], f"Gemini-only uploader: summary on their key, embeddings billed ({billed})")
        billed.clear()
        await ds._bill_indexing("u1", "d1", texts, texts[0], summary, "user-openai", None)
        check(billed == [], f"OpenAI uploader: nothing billed ({billed})")
    finally:
        ds.debit_credits = orig_debit

    from embeddings.embedding_service import EmbeddingService as _ES
    orig_key, settings.GEMINI_API_KEY = settings.GEMINI_API_KEY, "system-gemini"
    try:
        check(_ES()._get_gemini_fallback(None, "user-openai") is None, "BYOK OpenAI embedding quota: no system Gemini fallback")
    finally:
        settings.GEMINI_API_KEY = orig_key

    import workers.rabbitmq_consumer as consumer
    orig_url, settings.APP_URL = settings.APP_URL, "http://127.0.0.1:9"  # nothing listens here
    try:
        check(await consumer.fetch_user_ai_keys("u1") == (None, None), "key lookup failure -> index on system key")
    finally:
        settings.APP_URL = orig_url

    # 8. model config + refiner fail-open
    from crag import evaluator, refiner
    from embeddings.embedding_service import EmbeddingService
    llm = evaluator._get_llm(gemini_api_key="test-key")
    check(settings.GEMINI_FAST_MODEL in llm.model, f"CRAG gemini model from settings ({llm.model})")
    emb, prov, dim = EmbeddingService().get_embeddings_and_provider(gemini_api_key="test-key")
    check(settings.GEMINI_EMBEDDING_MODEL in emb.model and emb.output_dimensionality == dim == settings.GEMINI_EMBEDDING_DIM,
          f"gemini embeddings from settings ({emb.model}, dim={emb.output_dimensionality})")

    class _DeadChain:
        async def ainvoke(self, *_):
            raise RuntimeError("404 model retired")
    orig = refiner._get_filter_chain
    refiner._get_filter_chain = lambda *a: _DeadChain()
    out = await refiner.refine("q?", "CORRECT", [{"full_text": "Fact one. Fact two."}])
    refiner._get_filter_chain = orig
    check(out == "Fact one. Fact two.", f"refiner fails open when model is down ({out!r})")

    print("\nPASS" if not failures else f"\nFAIL — {len(failures)} check(s) failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
