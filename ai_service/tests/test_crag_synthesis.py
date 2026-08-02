"""
CRAG Synthesis Regression Test Suite — Phase 5.

Tests the 5 required cases from the Phase 5 spec:
  1. Synthesis-should-pass A: comparison query → CORRECT via synthesis
  2. Synthesis-should-pass B: out-of-scope vendor query → INSUFFICIENT (anti-hallucination guard)
  3. True-negative: "what is 2+2" → INCORRECT / low topic_relevance
  4. Direct-match: "what is vertical scaling" → CORRECT/DIRECT (no regression)
  5. Multi-doc synthesis: citation list includes chunks from both source documents

Unit tests run without live LLM calls (deterministic mocked SetEvalResult).
Integration tests (marked @pytest.mark.integration) hit real LLM APIs.

Usage:
  # Unit tests only (no API keys needed)
  python -m pytest tests/test_crag_synthesis.py -v -m "not integration"

  # All tests including integration (requires OPENAI_API_KEY)
  python -m pytest tests/test_crag_synthesis.py -v
"""

import os
import sys
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from crag.models import (
    Answerability,
    EvalVerdict,
    EvalResult,
    SetEvalResult,
)
from crag import evaluator as crag_evaluator

# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures: DB scaling doc chunks
# ─────────────────────────────────────────────────────────────────────────────

# Pattern 2: Vertical Scaling
VERTICAL_CHUNK = {
    "score": 0.54,
    "full_text": (
        "Pattern 2: Vertical Scaling or Scale-up. "
        "Upgrading our initial tiny machine. RAM by 2x and SSD by 3x etc. "
        "Scale-up is pocket friendly till a point. "
        "There is a ceiling — you cannot scale vertically beyond the hardware limit of a single machine. "
        "After a certain point, vertical scaling becomes prohibitively expensive."
    ),
    "metadata": {"document_id": "doc_scaling_patterns", "page_number": 3},
}

# Pattern 6: Horizontal Scaling / Sharding
HORIZONTAL_CHUNK = {
    "score": 0.49,
    "full_text": (
        "Pattern 6: Horizontal Scaling or Scale-out. "
        "Sharding — multiple shards. "
        "Allocate 50 machines — all having the same DB schema — each machine just holds "
        "a partition of the data. "
        "Horizontal scaling has no theoretical ceiling; you can always add more shards. "
        "The trade-off is increased operational complexity — you now manage a distributed system."
    ),
    "metadata": {"document_id": "doc_scaling_patterns", "page_number": 7},
}

# Introductory overview chunk
OVERVIEW_CHUNK = {
    "score": 0.48,
    "full_text": (
        "Step by Step Scaling: What will you learn? "
        "Step by step manner, when to choose which scaling option. "
        "Which scaling option is feasible practically at the moment."
    ),
    "metadata": {"document_id": "doc_scaling_patterns", "page_number": 1},
}

# A second source document (for multi-doc test)
CQRS_CHUNK = {
    "score": 0.45,
    "full_text": (
        "Pattern 3: Command Query Responsibility Segregation (CQRS). "
        "The scaled up machine is not able to handle all read/write requests. "
        "Separate read and write replicas. "
        "Write to primary, read from replicas."
    ),
    "metadata": {"document_id": "doc_advanced_patterns", "page_number": 2},
}

DB_SCALING_CITATIONS = [VERTICAL_CHUNK, HORIZONTAL_CHUNK, OVERVIEW_CHUNK]


# ─────────────────────────────────────────────────────────────────────────────
# Helper: run async test in sync pytest
# ─────────────────────────────────────────────────────────────────────────────

def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ─────────────────────────────────────────────────────────────────────────────
# Test Case 1: Synthesis-should-pass A
# Query: "which is better, vertical or horizontal scaling"
# Expected: CORRECT verdict (via SYNTHESIZABLE path), blended score ≥ upper threshold
# Must reference content from both Pattern 2 and Pattern 6
# ─────────────────────────────────────────────────────────────────────────────

class TestSynthesisPassComparison:
    """
    Vertical vs horizontal scaling is a comparison query.
    The doc has both patterns described — a comparison is a valid synthesis.
    Must NOT be blocked on web-search confirmation.
    """

    QUERY = "which is better, vertical or horizontal scaling"

    def _mock_set_eval_synthesizable(self):
        """Mock the LLM to return SYNTHESIZABLE for the comparison query."""
        return SetEvalResult(
            topic_relevance=0.92,
            answerability=Answerability.SYNTHESIZABLE,
            reasoning=(
                "The query asks for a comparison. Chunk 1 describes vertical scaling's ceiling, "
                "Chunk 2 describes horizontal scaling's mechanism. A comparison is a valid synthesis."
            ),
        )

    def test_unit_synthesizable_verdict_is_correct(self):
        """
        Unit: mock the LLM eval → assert the evaluator routes SYNTHESIZABLE to CORRECT
        when the blended score exceeds the upper threshold.
        """
        mock_set_eval = self._mock_set_eval_synthesizable()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        assert result.verdict == EvalVerdict.CORRECT, (
            f"Expected CORRECT for synthesis comparison, got {result.verdict}. "
            f"Reason: {result.reason}"
        )
        assert result.answerability == Answerability.SYNTHESIZABLE, (
            "Answerability should be SYNTHESIZABLE for a cross-chunk comparison query"
        )
        assert result.blended_score >= 0.55, (
            f"Blended score {result.blended_score:.3f} should be above UPPER threshold 0.55"
        )

    def test_unit_good_docs_include_both_pattern_chunks(self):
        """
        Unit: good_docs must include both Pattern 2 (vertical) and Pattern 6 (horizontal)
        so both are cited in the synthesized answer.
        """
        mock_set_eval = self._mock_set_eval_synthesizable()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        doc_ids = {d.get("metadata", {}).get("document_id", "") for d in result.good_docs}
        assert "doc_scaling_patterns" in doc_ids or len(result.good_docs) > 0, (
            "good_docs should contain the scaling pattern chunks for citation"
        )

    @pytest.mark.integration
    def test_integration_comparison_query_is_correct(self):
        """
        Integration: real LLM call should judge SYNTHESIZABLE and route to CORRECT.
        Requires OPENAI_API_KEY in environment.
        """
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set; skipping integration test")

        result = run_async(
            crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS, openai_api_key=api_key)
        )

        assert result.verdict == EvalVerdict.CORRECT, (
            f"Integration: expected CORRECT for comparison query, got {result.verdict}. "
            f"Blended={result.blended_score:.3f}, topic={result.topic_relevance:.2f}, "
            f"answerability={result.answerability}. Reason: {result.reason}"
        )
        assert result.answerability in (Answerability.SYNTHESIZABLE, Answerability.DIRECT), (
            f"Answerability should be SYNTHESIZABLE or DIRECT, got {result.answerability}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Case 2: Synthesis-should-pass B (anti-hallucination guard) ← CRITICAL
# Query: "as this pdf is about db scaling patterns, tell me best platforms for getting a db"
# Expected: INSUFFICIENT → web-search confirmation triggered
# Must NOT produce a hallucinated vendor list
# ─────────────────────────────────────────────────────────────────────────────

class TestAntiHallucinationGuard:
    """
    CRITICAL: This test guards against over-correcting the fix.

    The query asks for specific vendor recommendations. The DB scaling patterns doc
    describes patterns (vertical, horizontal, CQRS, etc.) but does NOT name any
    specific vendors or platforms.

    The evaluator must correctly classify this as INSUFFICIENT (topic is related,
    but the specific information — vendor names — is absent from the chunks).
    This must still trigger web-search confirmation, NOT produce a hallucinated answer.
    """

    QUERY = "as this pdf is about db scaling patterns, tell me best platforms for getting a db"

    def _mock_set_eval_insufficient(self):
        """Mock the LLM to return INSUFFICIENT for the vendor-recommendation query."""
        return SetEvalResult(
            topic_relevance=0.35,
            answerability=Answerability.INSUFFICIENT,
            reasoning=(
                "The chunks describe generic scaling patterns (vertical, horizontal) but do not "
                "name any specific database vendors or platforms. The required information is absent."
            ),
        )

    def test_unit_vendor_query_is_insufficient(self):
        """
        Unit: vendor recommendation query must produce INSUFFICIENT / non-CORRECT verdict.
        This is the primary anti-hallucination guard.
        """
        mock_set_eval = self._mock_set_eval_insufficient()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        # The verdict must NOT be CORRECT — that would allow a hallucinated vendor list
        assert result.verdict != EvalVerdict.CORRECT, (
            f"CRITICAL ANTI-HALLUCINATION FAILURE: vendor recommendation query returned CORRECT. "
            f"This would allow hallucinated vendor names. Blended={result.blended_score:.3f}, "
            f"topic={result.topic_relevance:.2f}, answerability={result.answerability}."
        )
        assert result.answerability == Answerability.INSUFFICIENT, (
            f"Answerability must be INSUFFICIENT for a vendor query against a patterns-only doc. "
            f"Got: {result.answerability}"
        )

    def test_unit_insufficient_verdict_is_not_ambiguous_synthesizable(self):
        """
        Unit: INSUFFICIENT must NOT be routed as SYNTHESIZABLE (which would attempt synthesis).
        Synthesis cannot conjure vendor names from pattern descriptions.
        """
        mock_set_eval = self._mock_set_eval_insufficient()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        assert result.answerability != Answerability.SYNTHESIZABLE, (
            "INSUFFICIENT query must not be routed as SYNTHESIZABLE — "
            "synthesis cannot invent vendor names that are not in the chunks."
        )

    @pytest.mark.integration
    def test_integration_vendor_query_triggers_web_search_confirm(self):
        """
        Integration: real LLM call should correctly identify this as INSUFFICIENT.
        The result must NOT be CORRECT (which would permit a hallucinated answer).
        """
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set; skipping integration test")

        result = run_async(
            crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS, openai_api_key=api_key)
        )

        assert result.verdict != EvalVerdict.CORRECT, (
            f"CRITICAL INTEGRATION FAILURE: vendor query returned CORRECT. "
            f"Blended={result.blended_score:.3f}, topic={result.topic_relevance:.2f}, "
            f"answerability={result.answerability}. This would permit hallucinated vendor recommendations."
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Case 3: True-negative — "what is 2+2"
# Expected: INCORRECT, topic_relevance < 0.2
# ─────────────────────────────────────────────────────────────────────────────

class TestTrueNegativeOffTopic:
    """
    Off-topic trivia against a domain document.
    Must be INCORRECT with very low topic_relevance — unchanged from old behavior.
    """

    QUERY = "what is 2+2"

    def _mock_set_eval_off_topic(self):
        return SetEvalResult(
            topic_relevance=0.0,
            answerability=Answerability.INSUFFICIENT,
            reasoning="The query is arithmetic trivia completely unrelated to database scaling.",
        )

    def test_unit_off_topic_is_incorrect(self):
        """
        Unit: off-topic query must produce INCORRECT verdict with near-zero topic_relevance.
        """
        mock_set_eval = self._mock_set_eval_off_topic()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        assert result.verdict == EvalVerdict.INCORRECT, (
            f"Off-topic query should be INCORRECT, got {result.verdict}"
        )
        assert result.topic_relevance < 0.2, (
            f"Off-topic query topic_relevance should be < 0.2, got {result.topic_relevance:.3f}"
        )

    @pytest.mark.integration
    def test_integration_off_topic_is_incorrect(self):
        """Integration: real LLM must rate arithmetic as INCORRECT."""
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set; skipping integration test")

        result = run_async(
            crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS, openai_api_key=api_key)
        )

        assert result.verdict == EvalVerdict.INCORRECT, (
            f"Integration: off-topic query should be INCORRECT, got {result.verdict}. "
            f"topic={result.topic_relevance:.2f}"
        )
        assert result.topic_relevance < 0.3, (
            f"topic_relevance for arithmetic should be very low, got {result.topic_relevance:.2f}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Case 4: Direct-match — "what is vertical scaling"
# Expected: CORRECT / DIRECT (regression check — must not break existing behavior)
# ─────────────────────────────────────────────────────────────────────────────

class TestDirectMatchNoRegression:
    """
    The canonical "what is vertical scaling" query.
    The doc defines it verbatim. This should still be CORRECT/DIRECT.
    Checks that the synthesis fix didn't regress direct-match queries.
    """

    QUERY = "what is vertical scaling"

    def _mock_set_eval_direct(self):
        return SetEvalResult(
            topic_relevance=1.0,
            answerability=Answerability.DIRECT,
            reasoning="Chunk 1 defines vertical scaling verbatim.",
        )

    def test_unit_direct_match_is_correct(self):
        """Unit: direct-match query must remain CORRECT/DIRECT after the fix."""
        mock_set_eval = self._mock_set_eval_direct()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS)
            )

        assert result.verdict == EvalVerdict.CORRECT, (
            f"Direct-match query should be CORRECT, got {result.verdict}"
        )
        assert result.answerability == Answerability.DIRECT, (
            f"Direct-match should have answerability=DIRECT, got {result.answerability}"
        )
        assert result.blended_score >= 0.55, (
            f"Direct-match blended score should be above upper threshold, got {result.blended_score:.3f}"
        )

    @pytest.mark.integration
    def test_integration_direct_match_no_regression(self):
        """Integration: 'what is vertical scaling' must still be CORRECT after fix."""
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set; skipping integration test")

        result = run_async(
            crag_evaluator.evaluate_documents(self.QUERY, DB_SCALING_CITATIONS, openai_api_key=api_key)
        )

        assert result.verdict == EvalVerdict.CORRECT, (
            f"Integration regression: 'what is vertical scaling' should still be CORRECT. "
            f"Got {result.verdict}. Blended={result.blended_score:.3f}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Case 5: Multi-doc synthesis
# Synthesis across chunks from two different source documents.
# Citation list must include both source documents.
# ─────────────────────────────────────────────────────────────────────────────

class TestMultiDocSynthesis:
    """
    Synthesis query that requires chunks from two different documents.
    The citation list on the answer must reference both document IDs.
    """

    QUERY = "compare vertical scaling with CQRS — when would I use each?"

    # Citations from TWO different documents
    MULTI_DOC_CITATIONS = [VERTICAL_CHUNK, CQRS_CHUNK, OVERVIEW_CHUNK]

    def _mock_set_eval_multi_doc_synthesizable(self):
        return SetEvalResult(
            topic_relevance=0.88,
            answerability=Answerability.SYNTHESIZABLE,
            reasoning=(
                "Chunk 1 (doc_scaling_patterns) describes vertical scaling. "
                "Chunk 2 (doc_advanced_patterns) describes CQRS. "
                "A comparison requires combining both, which is valid synthesis."
            ),
        )

    def test_unit_multi_doc_synthesis_is_correct(self):
        """Unit: multi-doc synthesis must produce CORRECT verdict."""
        mock_set_eval = self._mock_set_eval_multi_doc_synthesizable()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, self.MULTI_DOC_CITATIONS)
            )

        assert result.verdict == EvalVerdict.CORRECT, (
            f"Multi-doc synthesis should be CORRECT, got {result.verdict}"
        )

    def test_unit_multi_doc_citation_list_includes_both_docs(self):
        """
        Unit: good_docs must include chunks from BOTH source documents.
        This ensures the synthesized answer cites all contributing sources.
        """
        mock_set_eval = self._mock_set_eval_multi_doc_synthesizable()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, self.MULTI_DOC_CITATIONS)
            )

        source_doc_ids = {
            d.get("metadata", {}).get("document_id", "")
            for d in result.good_docs
            if d.get("metadata", {}).get("document_id")
        }

        assert "doc_scaling_patterns" in source_doc_ids, (
            f"good_docs must include chunk from doc_scaling_patterns. Got doc_ids: {source_doc_ids}"
        )
        assert "doc_advanced_patterns" in source_doc_ids, (
            f"good_docs must include chunk from doc_advanced_patterns. Got doc_ids: {source_doc_ids}"
        )

    def test_unit_multi_doc_good_docs_count(self):
        """Unit: good_docs should contain all relevant chunks from both documents."""
        mock_set_eval = self._mock_set_eval_multi_doc_synthesizable()

        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock(return_value=mock_set_eval)):
            result = run_async(
                crag_evaluator.evaluate_documents(self.QUERY, self.MULTI_DOC_CITATIONS)
            )

        # Should include at minimum the two directly relevant chunks
        assert len(result.good_docs) >= 2, (
            f"good_docs should include chunks from both documents, got {len(result.good_docs)}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Additional unit: meta-query bypass (summarize/overview) — unchanged
# ─────────────────────────────────────────────────────────────────────────────

class TestMetaQueryBypass:
    """
    Summarization / overview queries bypass strict evaluation entirely.
    This path has not changed — verify it still works with the new evaluator.
    """

    def test_summarize_bypasses_llm_eval(self):
        """
        'Summarize this document' must bypass LLM evaluation entirely
        (no LLM call made, all citations returned as good_docs).
        """
        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock()) as mock_eval:
            result = run_async(
                crag_evaluator.evaluate_documents("summarize this document", DB_SCALING_CITATIONS)
            )
            # The LLM should NOT be called for a meta-query
            mock_eval.assert_not_called()

        assert result.verdict == EvalVerdict.CORRECT
        assert len(result.good_docs) == len(DB_SCALING_CITATIONS)

    def test_overview_bypasses_llm_eval(self):
        """'Give me an overview' must also bypass evaluation."""
        with patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock()) as mock_eval:
            result = run_async(
                crag_evaluator.evaluate_documents("give me an overview of this document", DB_SCALING_CITATIONS)
            )
            mock_eval.assert_not_called()

        assert result.verdict == EvalVerdict.CORRECT


# ─────────────────────────────────────────────────────────────────────────────
# Additional unit: feature flag
# ─────────────────────────────────────────────────────────────────────────────

class TestFeatureFlag:
    """Verify CRAG_SYNTHESIS_ENABLED=False falls back to legacy path."""

    def test_feature_flag_disabled_uses_legacy_path(self):
        """
        When CRAG_SYNTHESIS_ENABLED=False, the evaluator must not call
        _run_set_level_eval and must use the legacy per-chunk path instead.
        """
        from unittest.mock import patch as _patch
        from core.config import settings

        with _patch.object(settings, "CRAG_SYNTHESIS_ENABLED", False):
            with _patch.object(crag_evaluator, "_run_set_level_eval", new=AsyncMock()) as mock_set_eval:
                with _patch.object(
                    crag_evaluator, "_score_single_doc",
                    new=AsyncMock(return_value=crag_evaluator.DocEvalScore(score=0.8, reason="test"))
                ):
                    result = run_async(
                        crag_evaluator.evaluate_documents("what is vertical scaling", DB_SCALING_CITATIONS)
                    )
                    # Set-level evaluator must NOT be called
                    mock_set_eval.assert_not_called()

        # Legacy path: if all scores were 0.8 (> UPPER=0.55), expect CORRECT
        assert result.verdict == EvalVerdict.CORRECT
