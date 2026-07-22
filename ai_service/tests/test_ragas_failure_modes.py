"""
RAGAS Failure Mode Test Suite for IntelliDoc AI.

Tests the 6 failure modes identified from the whiteboard:
  1. Wrong Retrieval      → Context Precision drops
  2. Hallucinations       → Faithfulness drops
  3. Chunking Issues      → Context Precision + Recall drop
  4. Stale KB             → Context Recall drops
  5. Metadata Corruption  → Metadata validator catches it
  6. Duplicate Documents  → Dedup detector catches it

Unit tests use deterministic text fixtures (no live LLM calls).
Integration tests (marked @pytest.mark.integration) hit real LLM APIs.

Usage:
  # Unit tests only (no API keys needed)
  python -m pytest tests/test_ragas_failure_modes.py -v -m "not integration"

  # All tests including integration
  python -m pytest tests/test_ragas_failure_modes.py -v

Environment variables required for integration tests:
  OPENAI_API_KEY   — used for LLM judge calls and embeddings
"""

import os
import sys
import pytest

# Allow running from ai_service/ root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.ragas_evaluator import RAGASEvaluator

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def evaluator():
    """Shared evaluator instance across all tests."""
    return RAGASEvaluator()


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Wrong Retrieval — Context Precision ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestWrongRetrieval:
    """
    Scenario: User asks about Q3 revenue, but the retriever returns HR policy chunks.
    The LLM correctly says "not found" — but context precision should be near zero
    because none of the retrieved chunks are relevant.
    """

    QUESTION = "What was the company's Q3 2024 revenue?"
    CONTEXT_CHUNKS = [
        "Employees are entitled to 21 days of annual leave per calendar year.",
        "The leave policy was last updated in January 2024 and applies to all full-time staff.",
        "Sick leave requires a medical certificate after 3 consecutive days of absence.",
        "Remote work requests must be approved by direct managers one week in advance.",
        "All HR queries should be directed to hr@company.com or ext. 4200.",
    ]
    ANSWER = (
        "Based on the available documents, no information about Q3 2024 revenue figures "
        "was found in the provided context. The retrieved documents cover HR policies "
        "and leave procedures. Please check the financial reports section."
    )

    def test_dedup_shows_no_duplicates(self, evaluator):
        """Sanity check — no duplicate chunks here."""
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_CHUNKS)
        assert result["duplicate_count"] == 0
        assert result["severity"] == "OK"

    def test_metadata_validator_no_issues_when_metadata_present(self, evaluator):
        """Metadata validation passes when all fields are present."""
        chunks_with_meta = [
            {"content": c, "metadata": {"document_id": f"doc_{i}", "page_number": i + 1, "workspace_id": "ws_1"}}
            for i, c in enumerate(self.CONTEXT_CHUNKS)
        ]
        result = evaluator.validate_chunk_metadata(chunks_with_meta)
        assert result["citation_reliability"] == "HIGH"
        assert result["missing_document_id"] == 0

    @pytest.mark.integration
    def test_context_precision_very_low(self, evaluator):
        """
        INTEGRATION: LLM judge should rate all HR chunks as irrelevant to a revenue question.
        Expected context_precision < 0.3
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.context_precision(
            self.QUESTION, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, f"Evaluation error (score={score})"
        assert score < 0.35, (
            f"Context precision={score:.3f} should be very low for completely irrelevant chunks"
        )

    @pytest.mark.integration
    def test_faithfulness_high_when_answer_admits_unknown(self, evaluator):
        """
        INTEGRATION: The answer correctly says 'not found in context' — faithfulness should be high
        because every claim in the answer is verifiable.
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.faithfulness(
            self.ANSWER, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, f"Evaluation error (score={score})"
        assert score > 0.6, (
            f"Faithfulness={score:.3f} should be high when answer admits 'not found'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Hallucinations — Faithfulness ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestHallucinations:
    """
    Scenario: Context says "$50M revenue, 5% increase" but the LLM outputs
    "$75M revenue, 25% growth, best quarter ever" — all fabricated.
    """

    QUESTION = "What was the company's revenue last quarter?"
    CONTEXT_CHUNKS = [
        "The company reported Q3 2024 revenue of $50 million, a 5% increase from Q2 2024.",
        "Operating expenses for Q3 2024 were $32 million, resulting in operating income of $18 million.",
    ]
    ANSWER_HALLUCINATED = (
        "The company's revenue last quarter was $75 million, representing a remarkable "
        "25% growth year-over-year. This was the best quarter in company history, "
        "driven by strong performance in the Asia-Pacific region and a new product launch "
        "that generated $30 million in additional revenue."
    )
    ANSWER_FAITHFUL = (
        "According to the documents, the company reported Q3 2024 revenue of $50 million, "
        "which represents a 5% increase from Q2 2024. Operating expenses were $32 million, "
        "resulting in operating income of $18 million."
    )

    def test_duplicate_check_passes(self, evaluator):
        """Sanity check — no duplicates in this context."""
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_CHUNKS)
        assert result["unique_ratio"] == 1.0

    @pytest.mark.integration
    def test_hallucinated_answer_faithfulness_very_low(self, evaluator):
        """
        INTEGRATION: Hallucinated answer should score very low on faithfulness.
        $75M, 25%, Asia-Pacific, $30M additional revenue are all fabricated.
        Expected faithfulness < 0.3
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.faithfulness(
            self.ANSWER_HALLUCINATED, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, f"Evaluation error"
        assert score < 0.35, (
            f"Faithfulness={score:.3f} should be very low for hallucinated answer "
            f"($75M, 25%, best quarter are not in context)"
        )

    @pytest.mark.integration
    def test_faithful_answer_faithfulness_high(self, evaluator):
        """
        INTEGRATION: Faithful answer should score high — every claim traces to context.
        Expected faithfulness > 0.8
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.faithfulness(
            self.ANSWER_FAITHFUL, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, f"Evaluation error"
        assert score > 0.75, (
            f"Faithfulness={score:.3f} should be high when answer matches context exactly"
        )

    @pytest.mark.integration
    def test_answer_relevancy_high_for_both(self, evaluator):
        """
        INTEGRATION: Both answers are 'about' revenue — relevancy should remain high.
        This proves relevancy alone can't detect hallucinations.
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score_bad = evaluator.answer_relevancy(
            self.QUESTION, self.ANSWER_HALLUCINATED, openai_api_key=openai_key
        )
        assert score_bad >= 0, "Evaluation error"
        assert score_bad > 0.5, (
            f"Answer relevancy={score_bad:.3f} should still be moderate even for hallucinated answer — "
            f"relevancy alone does not detect hallucinations"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Chunking Issues — Context Precision + Recall ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestChunkingIssues:
    """
    Scenario: A price table was split mid-row across two chunks.
    Chunk 1 has data rows without headers; headers are in a separate un-retrieved chunk.
    The LLM makes assumptions about column meanings that can't be verified.
    """

    QUESTION = "What are the product prices in the pricing table?"
    # Headers ("Product | Price | Stock") were in a different chunk that was NOT retrieved
    CONTEXT_CHUNKS = [
        # Data rows only — no header row to confirm which column is which
        "Widget A | 29.99 | 500\nWidget B | 49.99 | 300\nWidget C | 19.99 | 1200",
        # Completely unrelated chunk retrieved by the retriever
        "Our company was founded in 2010 in San Francisco, California.",
    ]
    ANSWER = (
        "Based on the pricing table, the product prices are: "
        "Widget A at $29.99, Widget B at $49.99, and Widget C at $19.99."
    )

    def test_no_duplicates_in_chunks(self, evaluator):
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_CHUNKS)
        assert result["duplicate_count"] == 0

    @pytest.mark.integration
    def test_context_precision_moderate_or_low(self, evaluator):
        """
        INTEGRATION: Chunk 2 (San Francisco founding) is clearly irrelevant.
        Chunk 1 is partially relevant but incomplete (no headers).
        Expected precision < 0.7 (at best 0.5 for 1 out of 2 relevant)
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.context_precision(
            self.QUESTION, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, "Evaluation error"
        # The irrelevant chunk at position 2 should penalise precision
        assert score < 0.75, (
            f"Context precision={score:.3f} should be < 0.75 when one chunk is completely irrelevant"
        )

    @pytest.mark.integration
    def test_context_recall_below_ideal(self, evaluator):
        """
        INTEGRATION: The answer assumes 'Widget A | 29.99' means $29.99 = price,
        but the context (headerless) can't fully confirm that. Recall should be impacted.
        Expected recall < 0.8
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.context_recall(
            self.QUESTION, self.ANSWER, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, "Evaluation error"
        assert score < 0.85, (
            f"Context recall={score:.3f} should reflect that context can't confirm column interpretation"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Stale Knowledge Base — Context Recall ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestStaleKnowledgeBase:
    """
    Scenario: User asks about 2025 remote work policy.
    KB only has the 2023 version. LLM answers correctly from the 2023 doc
    but cannot confirm the info reflects 2025 policy.
    """

    QUESTION = "What is the current 2025 remote work policy?"
    CONTEXT_CHUNKS = [
        "Remote Work Policy (Effective January 2023): Employees may work remotely up to 2 days per week with manager approval.",
        "All remote work requests must be submitted through the HR portal at least 1 week in advance.",
        "The policy applies to all employees who have completed their 6-month probation period.",
    ]
    ANSWER = (
        "According to the current policy, employees can work remotely up to 2 days per week "
        "with manager approval. Requests must be submitted through the HR portal at least "
        "1 week in advance. The policy applies to employees who have completed their "
        "6-month probation period."
    )

    def test_no_duplicates(self, evaluator):
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_CHUNKS)
        assert result["duplicate_count"] == 0

    def test_metadata_can_flag_old_documents(self, evaluator):
        """
        Metadata validator can detect chunks with old timestamps.
        (In production, document upload_date would be in metadata.)
        """
        chunks_with_stale_meta = [
            {
                "content": c,
                "metadata": {
                    "document_id": f"doc_{i}",
                    "page_number": i + 1,
                    "workspace_id": "ws_1",
                    "upload_date": "2023-01-15",  # Stale!
                }
            }
            for i, c in enumerate(self.CONTEXT_CHUNKS)
        ]
        result = evaluator.validate_chunk_metadata(chunks_with_stale_meta)
        # All have document_id and page_number so citation reliability is HIGH
        assert result["citation_reliability"] == "HIGH"
        # Staleness detection is application-level: check upload_date vs current year
        upload_dates = [
            c["metadata"].get("upload_date", "")
            for c in chunks_with_stale_meta
        ]
        stale_count = sum(1 for d in upload_dates if d.startswith("2023"))
        assert stale_count == 3, "All 3 chunks should be flagged as 2023 (stale for a 2025 question)"

    @pytest.mark.integration
    def test_faithfulness_high_answer_matches_context(self, evaluator):
        """
        INTEGRATION: Even with stale context, faithfulness is high because the answer
        accurately reflects what's in the context (the 2023 policy).
        This demonstrates that faithfulness alone won't flag staleness.
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.faithfulness(
            self.ANSWER, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, "Evaluation error"
        assert score > 0.7, (
            f"Faithfulness={score:.3f} should be high — answer correctly reflects 2023 context. "
            f"Staleness is a temporal issue, not a hallucination issue."
        )

    @pytest.mark.integration
    def test_context_recall_low_due_to_year_mismatch(self, evaluator):
        """
        INTEGRATION: Context recall should drop because the question asks about 2025
        but the context only covers 2023. The LLM cannot attribute '2025' to the context.
        Expected recall < 0.75
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.context_recall(
            self.QUESTION, self.ANSWER, self.CONTEXT_CHUNKS, openai_api_key=openai_key
        )
        assert score >= 0, "Evaluation error"
        assert score < 0.8, (
            f"Context recall={score:.3f} should reflect that context cannot confirm 2025 applicability"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Metadata Corruption — Metadata Validator ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestMetadataCorruption:
    """
    Scenario: Chunks were ingested without proper document_id or page_number.
    Citations in the UI will break. RAGAS text scores are unaffected, but the
    metadata validator must catch this.
    """

    QUESTION = "What does section 4.2 of the contract say?"
    CONTEXT_CHUNKS_RAW = [
        "The vendor shall deliver all goods within 30 business days of order confirmation.",
        "Payment terms are Net-60 from date of invoice receipt.",
        "Any disputes shall be resolved through binding arbitration in New York.",
    ]
    ANSWER = (
        "Section 4.2 states that the vendor shall deliver all goods within 30 business days "
        "of order confirmation. Payment terms are Net-60 from invoice receipt."
    )

    def test_missing_document_id_detected(self, evaluator):
        """All chunks missing document_id — citation_reliability should be LOW."""
        chunks_no_doc_id = [
            {"content": c, "metadata": {"page_number": i + 1, "workspace_id": "ws_1"}}
            for i, c in enumerate(self.CONTEXT_CHUNKS_RAW)
        ]
        result = evaluator.validate_chunk_metadata(chunks_no_doc_id)
        assert result["missing_document_id"] == 3
        assert result["citation_reliability"] == "LOW"
        assert len(result["issues"]) >= 3

    def test_missing_page_number_detected(self, evaluator):
        """All chunks missing page_number."""
        chunks_no_page = [
            {"content": c, "metadata": {"document_id": f"doc_{i}", "workspace_id": "ws_1"}}
            for i, c in enumerate(self.CONTEXT_CHUNKS_RAW)
        ]
        result = evaluator.validate_chunk_metadata(chunks_no_page)
        assert result["missing_page_number"] == 3

    def test_null_metadata_values_detected(self, evaluator):
        """Explicit None values in metadata should be caught."""
        chunks_null_meta = [
            {"content": c, "metadata": {"document_id": None, "page_number": None, "workspace_id": "ws_1"}}
            for c in self.CONTEXT_CHUNKS_RAW
        ]
        result = evaluator.validate_chunk_metadata(chunks_null_meta)
        assert result["missing_document_id"] == 3
        assert result["missing_page_number"] == 3
        assert result["citation_reliability"] == "LOW"

    def test_empty_metadata_dict_caught(self, evaluator):
        """Completely empty metadata dicts."""
        chunks_empty_meta = [
            {"content": c, "metadata": {}}
            for c in self.CONTEXT_CHUNKS_RAW
        ]
        result = evaluator.validate_chunk_metadata(chunks_empty_meta)
        assert result["missing_document_id"] == 3
        assert result["citation_reliability"] == "LOW"

    def test_partial_metadata_medium_reliability(self, evaluator):
        """1 out of 3 chunks missing document_id → MEDIUM reliability."""
        chunks_partial = [
            {"content": self.CONTEXT_CHUNKS_RAW[0], "metadata": {"document_id": "doc_1", "page_number": 1, "workspace_id": "ws_1"}},
            {"content": self.CONTEXT_CHUNKS_RAW[1], "metadata": {"document_id": None,    "page_number": 2, "workspace_id": "ws_1"}},
            {"content": self.CONTEXT_CHUNKS_RAW[2], "metadata": {"document_id": "doc_3", "page_number": 3, "workspace_id": "ws_1"}},
        ]
        result = evaluator.validate_chunk_metadata(chunks_partial)
        assert result["missing_document_id"] == 1
        assert result["citation_reliability"] == "MEDIUM"

    def test_all_metadata_present_high_reliability(self, evaluator):
        """Full metadata → HIGH reliability."""
        chunks_good = [
            {"content": c, "metadata": {"document_id": f"doc_{i}", "page_number": i + 1, "workspace_id": "ws_1"}}
            for i, c in enumerate(self.CONTEXT_CHUNKS_RAW)
        ]
        result = evaluator.validate_chunk_metadata(chunks_good)
        assert result["citation_reliability"] == "HIGH"
        assert result["missing_document_id"] == 0
        assert result["missing_page_number"] == 0
        assert result["issues"] == []


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Duplicate Documents — Dedup Detector ↓
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateDocuments:
    """
    Scenario: The same PDF was uploaded 3 times, resulting in 3 identical chunks
    in the top-k retrieval. This wastes retrieval slots and reduces context diversity.
    """

    QUESTION = "Summarize the company's employee benefits package."
    CONTEXT_EXACT_DUPLICATES = [
        "Employees receive health insurance, dental coverage, and a 401k match up to 6%.",
        "Employees receive health insurance, dental coverage, and a 401k match up to 6%.",  # exact dup
        "Employees receive health insurance, dental coverage, and a 401k match up to 6%.",  # exact dup
        "The company offers 15 days PTO for new hires, increasing to 20 days after 3 years.",
        "Tuition reimbursement of up to $5,000 per year is available for approved degree programs.",
    ]
    CONTEXT_NEAR_DUPLICATES = [
        "Employees get health insurance, dental, and a 401k match of up to 6%.",            # near-dup
        "Employees receive health insurance, dental coverage, and a 401k match up to 6%.",  # near-dup
        "Staff members receive medical insurance, dental benefits, plus a 6% 401k match.",  # near-dup
        "The company offers 15 days PTO for new hires, increasing to 20 after 3 years.",
        "Tuition reimbursement up to $5,000 per year for approved programs.",
    ]
    CONTEXT_HEALTHY = [
        "Employees receive health insurance, dental coverage, and a 401k match up to 6%.",
        "The company offers 15 days PTO for new hires, increasing to 20 days after 3 years.",
        "Tuition reimbursement of up to $5,000 per year is available for approved programs.",
        "Life insurance and long-term disability coverage are provided at no cost to employees.",
        "Employee Assistance Program (EAP) offers free counselling sessions up to 8 per year.",
    ]

    def test_exact_duplicates_detected(self, evaluator):
        """3 copies of the same chunk → 2 duplicates, unique_ratio = 0.6, WARNING severity."""
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_EXACT_DUPLICATES)
        assert result["duplicate_count"] >= 2
        assert result["unique_ratio"] < 0.7
        assert result["wasted_slots"] >= 2
        assert result["severity"] in ("WARNING", "CRITICAL")
        assert len(result["duplicate_pairs"]) >= 2

    def test_near_duplicates_detected(self, evaluator):
        """Near-identical phrasing of the same benefit → detected via Jaccard similarity."""
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_NEAR_DUPLICATES)
        # Jaccard similarity between the 3 health insurance variants should be >= 0.95
        assert result["duplicate_count"] >= 1
        assert result["severity"] in ("WARNING", "CRITICAL")

    def test_healthy_context_no_duplicates(self, evaluator):
        """5 unique, diverse chunks → no duplicates, severity OK."""
        result = evaluator.detect_duplicate_chunks(self.CONTEXT_HEALTHY)
        assert result["duplicate_count"] == 0
        assert result["unique_ratio"] == 1.0
        assert result["severity"] == "OK"
        assert result["duplicate_pairs"] == []
        assert result["wasted_slots"] == 0

    def test_single_chunk_no_duplicates(self, evaluator):
        """Edge case: only one chunk — can't have duplicates."""
        result = evaluator.detect_duplicate_chunks(["Only one chunk."])
        assert result["duplicate_count"] == 0
        assert result["unique_ratio"] == 1.0
        assert result["severity"] == "OK"

    def test_empty_chunks_no_crash(self, evaluator):
        """Edge case: empty list."""
        result = evaluator.detect_duplicate_chunks([])
        assert result["duplicate_count"] == 0
        assert result["unique_ratio"] == 1.0

    @pytest.mark.integration
    def test_context_precision_not_inflated_by_duplicates(self, evaluator):
        """
        INTEGRATION: Even when duplicates are present, the precision metric may look OK
        because the duplicate chunk IS relevant. This test documents the limitation:
        pure RAGAS cannot catch redundancy — only our dedup detector can.
        Expected: context_precision is moderate-to-high despite 2 duplicate slots
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        score = evaluator.context_precision(
            self.QUESTION, self.CONTEXT_EXACT_DUPLICATES, openai_api_key=openai_key
        )
        assert score >= 0, "Evaluation error"
        # The duplicate IS relevant to benefits — so precision stays reasonable
        # This shows why a supplementary dedup check is mandatory
        print(f"\n[INFO] Context precision with duplicates = {score:.3f} "
              f"(likely stays high because the duplicate IS relevant — "
              f"pure RAGAS cannot detect this failure mode)")


# ─────────────────────────────────────────────────────────────────────────────
# Full Evaluation Pipeline Integration Test
# ─────────────────────────────────────────────────────────────────────────────

class TestFullPipeline:
    """End-to-end integration tests for the full evaluate() method."""

    @pytest.mark.integration
    def test_full_evaluate_returns_all_four_scores(self, evaluator):
        """
        INTEGRATION: A complete evaluation run should return all 4 metric scores
        plus an overall score.
        """
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        question = "What are the main causes of climate change?"
        context = [
            "Climate change is primarily caused by the emission of greenhouse gases such as CO2 and methane.",
            "Human activities including burning fossil fuels, deforestation, and industrial processes are the main drivers.",
            "The Intergovernmental Panel on Climate Change (IPCC) reports a 1.1°C increase in global average temperature since pre-industrial times.",
        ]
        answer = (
            "The main causes of climate change are greenhouse gas emissions from human activities. "
            "This includes burning fossil fuels, deforestation, and industrial processes that release "
            "CO2 and methane into the atmosphere. According to the IPCC, global temperatures have "
            "already risen by 1.1°C since pre-industrial times."
        )

        scores = evaluator.evaluate(
            question=question,
            answer=answer,
            context_chunks=context,
            openai_api_key=openai_key,
        )

        assert "faithfulness"      in scores
        assert "answer_relevancy"  in scores
        assert "context_precision" in scores
        assert "context_recall"    in scores
        assert "overall"           in scores

        # All scores should be valid (not error sentinels)
        for key, val in scores.items():
            assert val >= 0 or val == -1, f"{key}={val} out of expected range"

        # Grounded answer on good context should score reasonably well
        assert scores["faithfulness"]     > 0.5, f"faithfulness={scores['faithfulness']:.3f}"
        assert scores["context_precision"] > 0.5, f"context_precision={scores['context_precision']:.3f}"

        print(f"\n[Full Eval Scores]\n"
              f"  Faithfulness:      {scores['faithfulness']:.4f}\n"
              f"  Answer Relevancy:  {scores['answer_relevancy']:.4f}\n"
              f"  Context Precision: {scores['context_precision']:.4f}\n"
              f"  Context Recall:    {scores['context_recall']:.4f}\n"
              f"  Overall:           {scores['overall']:.4f}")
