"""
RAGAS-inspired evaluation module for IntelliDoc AI.

Implements 4 core RAG quality metrics using an LLM-as-judge approach:
  1. Faithfulness        — are all answer claims supported by the context?
  2. Answer Relevancy    — does the answer actually address the question?
  3. Context Precision   — are the most relevant chunks ranked at the top?
  4. Context Recall      — does the context cover all info needed to answer?

Plus two supplementary structural health checks:
  5. validate_chunk_metadata()  — detects missing document_id / page_number
  6. detect_duplicate_chunks()  — flags redundant chunks wasting top-k slots

All LLM calls use a lightweight model (gpt-4o-mini / gemini-1.5-flash) to
keep evaluation costs minimal. Each full evaluation makes 4 LLM calls.
"""

from __future__ import annotations  # Python 3.9 compatibility for X | Y type hints

import json
import logging
import re
from typing import Any

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ─────────────────────────────────────────────────────────────────────────────

def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors without numpy dependency."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = sum(a * a for a in vec_a) ** 0.5
    mag_b = sum(b * b for b in vec_b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _parse_json_response(raw: str) -> Any:
    """Strip markdown code fences and parse JSON from an LLM response."""
    cleaned = raw.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned.strip())


def _clamp(value: float) -> float:
    """Clamp a score to [0.0, 1.0]."""
    return max(0.0, min(1.0, value))


# ─────────────────────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────────────────────

FAITHFULNESS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert fact-checker. Given an answer and context, extract every distinct factual claim from the answer, then check if each claim is supported by the context.

Return ONLY valid JSON (no markdown, no extra text):
{{
  "claims": ["claim 1", "claim 2", ...],
  "verdicts": [1, 0, ...]   // 1 = supported, 0 = not supported (same order as claims)
}}

Rules:
- A claim is "supported" if the context explicitly states or logically implies it.
- If the answer says "I don't know" or "not found in context", that counts as a supported claim (score = 1).
- Do NOT penalise for correct inferences from the context.

Context:
{context}

Answer:
{answer}""")
])

ANSWER_RELEVANCY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at question generation. Given an answer, generate {n} distinct questions that this answer would be a good response to.

Return ONLY valid JSON (no markdown, no extra text):
{{
  "questions": ["question 1", "question 2", ...]
}}

Answer:
{answer}""")
])

CONTEXT_PRECISION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert relevance judge. Given a question and a list of retrieved context chunks (numbered starting at 1), decide if each chunk is RELEVANT to answering the question.

Return ONLY valid JSON (no markdown, no extra text):
{{
  "verdicts": [1, 0, 1, ...]   // 1 = relevant, 0 = not relevant (one per chunk, same order)
}}

Question: {question}

Context Chunks:
{chunks_text}""")
])

CONTEXT_RECALL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at source attribution. Given an answer and context, split the answer into individual sentences and determine if each sentence can be attributed to (i.e., is supported by) the context.

Return ONLY valid JSON (no markdown, no extra text):
{{
  "sentences": ["sentence 1", "sentence 2", ...],
  "attributed": [1, 0, ...]   // 1 = can be attributed to context, 0 = cannot (same order)
}}

Rules:
- A sentence is "attributed" if the context contains information that supports it.
- Transitional phrases ("Based on the context,", "According to the documents,") should not be evaluated alone.
- Ignore sentences that are purely meta-commentary about the context itself.

Context:
{context}

Answer:
{answer}""")
])


# ─────────────────────────────────────────────────────────────────────────────
# Main Evaluator
# ─────────────────────────────────────────────────────────────────────────────

class RAGASEvaluator:
    """
    Evaluates RAG pipeline quality using 4 RAGAS-inspired metrics.
    Uses a small/fast LLM for judgments to keep API costs low.
    """

    def __init__(self):
        self._llm_cache: dict = {}
        self._emb_cache: dict = {}

    # ── Private helpers ───────────────────────────────────────────────────────

    def _get_llm(self, openai_api_key: str = None, gemini_api_key: str = None):
        key = openai_api_key or gemini_api_key or "default"
        if key not in self._llm_cache:
            if openai_api_key:
                self._llm_cache[key] = ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0,
                    openai_api_key=openai_api_key
                )
            elif gemini_api_key:
                self._llm_cache[key] = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
                    temperature=0,
                    google_api_key=gemini_api_key
                )
            else:
                self._llm_cache[key] = ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0,
                    openai_api_key=settings.OPENAI_API_KEY
                )
        return self._llm_cache[key]

    def _get_embeddings(self, openai_api_key: str = None, gemini_api_key: str = None):
        key = (openai_api_key or gemini_api_key or "default") + "_emb"
        if key not in self._emb_cache:
            if openai_api_key:
                self._emb_cache[key] = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    openai_api_key=openai_api_key
                )
            elif gemini_api_key:
                self._emb_cache[key] = GoogleGenerativeAIEmbeddings(
                    model="models/embedding-001",
                    google_api_key=gemini_api_key
                )
            else:
                self._emb_cache[key] = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    openai_api_key=settings.OPENAI_API_KEY
                )
        return self._emb_cache[key]

    def _invoke_llm(self, prompt, llm, **kwargs) -> str:
        chain = prompt | llm | StrOutputParser()
        return chain.invoke(kwargs)

    # ── Metric 1: Faithfulness ────────────────────────────────────────────────

    def faithfulness(
        self,
        answer: str,
        context_chunks: list[str],
        openai_api_key: str = None,
        gemini_api_key: str = None,
    ) -> float:
        """
        Measures whether every factual claim in the answer is supported by the context.
        Score = supported_claims / total_claims. Range: [0, 1].

        Detects: Hallucinations (Failure Mode #2)
        """
        if not answer.strip() or not context_chunks:
            return 0.0

        context = "\n\n---\n\n".join(context_chunks)
        llm = self._get_llm(openai_api_key, gemini_api_key)

        try:
            raw = self._invoke_llm(FAITHFULNESS_PROMPT, llm, context=context, answer=answer)
            data = _parse_json_response(raw)
            claims = data.get("claims", [])
            verdicts = data.get("verdicts", [])

            if not claims:
                return 1.0  # No extractable claims → assume faithful

            supported = sum(1 for v in verdicts if v == 1)
            score = supported / len(claims)
            logger.info(f"Faithfulness: {supported}/{len(claims)} claims supported → {score:.3f}")
            return _clamp(score)

        except Exception as e:
            logger.error(f"Faithfulness evaluation failed: {e}")
            return -1.0  # Sentinel for "evaluation error"

    # ── Metric 2: Answer Relevancy ────────────────────────────────────────────

    def answer_relevancy(
        self,
        question: str,
        answer: str,
        n_synthetic: int = 3,
        openai_api_key: str = None,
        gemini_api_key: str = None,
    ) -> float:
        """
        Measures whether the answer is relevant to the original question.
        Generates N synthetic questions from the answer, then computes mean
        cosine similarity between those and the original question embedding.
        Score ∈ [0, 1].

        Detects: Wrong Retrieval side-effect where answer drifts off-topic (Failure Mode #1)
        """
        if not answer.strip() or not question.strip():
            return 0.0

        llm = self._get_llm(openai_api_key, gemini_api_key)
        emb = self._get_embeddings(openai_api_key, gemini_api_key)

        try:
            raw = self._invoke_llm(
                ANSWER_RELEVANCY_PROMPT, llm,
                answer=answer, n=n_synthetic
            )
            data = _parse_json_response(raw)
            synthetic_questions = data.get("questions", [])

            if not synthetic_questions:
                return 0.0

            # Embed original question + synthetic questions
            all_texts = [question] + synthetic_questions
            vectors = emb.embed_documents(all_texts)
            original_vec = vectors[0]
            synth_vecs = vectors[1:]

            # Mean cosine similarity
            similarities = [_cosine_similarity(original_vec, sv) for sv in synth_vecs]
            score = sum(similarities) / len(similarities)
            logger.info(f"Answer Relevancy: mean similarity={score:.3f} over {len(similarities)} synthetic questions")
            return _clamp(score)

        except Exception as e:
            logger.error(f"Answer Relevancy evaluation failed: {e}")
            return -1.0

    # ── Metric 3: Context Precision ───────────────────────────────────────────

    def context_precision(
        self,
        question: str,
        context_chunks: list[str],
        openai_api_key: str = None,
        gemini_api_key: str = None,
    ) -> float:
        """
        Measures whether relevant chunks are ranked at the top of the retrieved list.
        Uses average precision (AP) — rewards systems that put relevant chunks first.
        Score ∈ [0, 1].

        Detects: Wrong Retrieval (#1), Chunking issues (#3), Stale KB (#4), Duplicates (#6)
        """
        if not context_chunks or not question.strip():
            return 0.0

        llm = self._get_llm(openai_api_key, gemini_api_key)

        # Format chunks as a numbered list for the judge
        chunks_text = "\n\n".join(
            f"Chunk {i + 1}:\n{chunk}" for i, chunk in enumerate(context_chunks)
        )

        try:
            raw = self._invoke_llm(
                CONTEXT_PRECISION_PROMPT, llm,
                question=question, chunks_text=chunks_text
            )
            data = _parse_json_response(raw)
            verdicts = data.get("verdicts", [])

            if not verdicts:
                return 0.0

            # Pad or trim to match actual chunk count
            verdicts = verdicts[:len(context_chunks)]

            # Average Precision: rewards relevant chunks at higher ranks
            # AP = (1/R) * sum_k [ (relevant_up_to_k / k) * is_relevant_k ]
            relevant_total = sum(verdicts)
            if relevant_total == 0:
                return 0.0

            running_relevant = 0
            precision_sum = 0.0
            for k, v in enumerate(verdicts, start=1):
                if v == 1:
                    running_relevant += 1
                    precision_sum += running_relevant / k

            score = precision_sum / relevant_total
            logger.info(f"Context Precision: AP={score:.3f}, verdicts={verdicts}")
            return _clamp(score)

        except Exception as e:
            logger.error(f"Context Precision evaluation failed: {e}")
            return -1.0

    # ── Metric 4: Context Recall ──────────────────────────────────────────────

    def context_recall(
        self,
        question: str,
        answer: str,
        context_chunks: list[str],
        openai_api_key: str = None,
        gemini_api_key: str = None,
    ) -> float:
        """
        Approximates context recall without ground truth.
        Splits the answer into sentences and checks what fraction can be
        attributed back to the context. High score means context had all
        the information needed; low score means the LLM filled in gaps.
        Score ∈ [0, 1].

        Detects: Chunking issues (#3), Stale KB (#4)
        NOTE: Approximate — uses self-consistency (no ground truth required).
        """
        if not answer.strip() or not context_chunks:
            return 0.0

        context = "\n\n---\n\n".join(context_chunks)
        llm = self._get_llm(openai_api_key, gemini_api_key)

        try:
            raw = self._invoke_llm(
                CONTEXT_RECALL_PROMPT, llm,
                context=context, answer=answer
            )
            data = _parse_json_response(raw)
            sentences = data.get("sentences", [])
            attributed = data.get("attributed", [])

            if not sentences:
                return 1.0  # No sentences to evaluate

            supported = sum(1 for v in attributed if v == 1)
            score = supported / len(sentences)
            logger.info(f"Context Recall: {supported}/{len(sentences)} sentences attributed → {score:.3f}")
            return _clamp(score)

        except Exception as e:
            logger.error(f"Context Recall evaluation failed: {e}")
            return -1.0

    # ── Supplementary: Metadata Validator ────────────────────────────────────

    def validate_chunk_metadata(
        self,
        context_chunks: list[dict],
    ) -> dict:
        """
        Validates structural integrity of retrieved chunks' metadata.
        Detects missing document_id, page_number, workspace_id.

        Detects: Metadata corruption/loss (Failure Mode #5)

        Args:
            context_chunks: List of dicts with keys "content" and "metadata".

        Returns:
            {
              "missing_document_id": int,
              "missing_page_number": int,
              "missing_workspace_id": int,
              "total_chunks": int,
              "citation_reliability": "HIGH" | "MEDIUM" | "LOW",
              "issues": [str]
            }
        """
        missing_doc_id = 0
        missing_page = 0
        missing_workspace = 0
        issues = []

        for i, chunk in enumerate(context_chunks):
            meta = chunk.get("metadata", {}) if isinstance(chunk, dict) else {}
            if not meta.get("document_id"):
                missing_doc_id += 1
                issues.append(f"Chunk {i + 1}: missing document_id")
            if meta.get("page_number") is None:
                missing_page += 1
                issues.append(f"Chunk {i + 1}: missing page_number")
            if not meta.get("workspace_id"):
                missing_workspace += 1
                issues.append(f"Chunk {i + 1}: missing workspace_id")

        total = len(context_chunks)
        missing_ratio = missing_doc_id / total if total > 0 else 0

        if missing_ratio == 0:
            reliability = "HIGH"
        elif missing_ratio < 0.5:
            reliability = "MEDIUM"
        else:
            reliability = "LOW"

        return {
            "missing_document_id": missing_doc_id,
            "missing_page_number": missing_page,
            "missing_workspace_id": missing_workspace,
            "total_chunks": total,
            "citation_reliability": reliability,
            "issues": issues,
        }

    # ── Supplementary: Duplicate Chunk Detector ───────────────────────────────

    def detect_duplicate_chunks(
        self,
        context_chunks: list,
        similarity_threshold: float = 0.6,
    ) -> dict:
        """
        Detects near-duplicate or exact-duplicate chunks in the top-k retrieval.
        Uses exact text matching for identical duplicates and character-level
        Jaccard similarity for near-duplicates.

        Detects: Duplicate documents uploaded multiple times (Failure Mode #6)

        Returns:
            {
              "duplicate_count": int,
              "unique_ratio": float,
              "wasted_slots": int,
              "severity": "OK" | "WARNING" | "CRITICAL",
              "duplicate_pairs": [(i, j)]
            }
        """
        # Extract text content
        texts = []
        for chunk in context_chunks:
            if isinstance(chunk, dict):
                texts.append(chunk.get("content", "").strip().lower())
            else:
                texts.append(str(chunk).strip().lower())

        n = len(texts)
        seen_exact: set[str] = set()
        duplicate_pairs: list[tuple[int, int]] = []
        duplicates: set[int] = set()

        for i in range(n):
            for j in range(i + 1, n):
                # Exact match
                if texts[i] == texts[j]:
                    duplicate_pairs.append((i, j))
                    duplicates.add(j)
                    continue

                # Near-duplicate via character Jaccard similarity
                set_i = set(texts[i].split())
                set_j = set(texts[j].split())
                union = set_i | set_j
                if not union:
                    continue
                jaccard = len(set_i & set_j) / len(union)
                if jaccard >= similarity_threshold:
                    duplicate_pairs.append((i, j))
                    duplicates.add(j)

        dup_count = len(duplicates)
        unique_ratio = (n - dup_count) / n if n > 0 else 1.0
        wasted_slots = dup_count

        if dup_count == 0:
            severity = "OK"
        elif dup_count <= 1 or unique_ratio >= 0.7:
            severity = "WARNING"
        else:
            severity = "CRITICAL"

        return {
            "duplicate_count": dup_count,
            "unique_ratio": round(unique_ratio, 3),
            "wasted_slots": wasted_slots,
            "severity": severity,
            "duplicate_pairs": duplicate_pairs,
        }

    # ── Full Evaluation Pipeline ──────────────────────────────────────────────

    def evaluate(
        self,
        question: str,
        answer: str,
        context_chunks: list[str],
        openai_api_key: str = None,
        gemini_api_key: str = None,
    ) -> dict:
        """
        Run all 4 RAGAS metrics and return a consolidated score dict.

        Args:
            question:       The user's query.
            answer:         The LLM-generated answer.
            context_chunks: List of retrieved text chunks (strings).
            openai_api_key: Optional user-provided OpenAI key.
            gemini_api_key: Optional user-provided Gemini key.

        Returns:
            {
              "faithfulness":       float,  # [0,1] or -1 on error
              "answer_relevancy":   float,
              "context_precision":  float,
              "context_recall":     float,
              "overall":            float,  # mean of valid scores
            }
        """
        logger.info(f"Starting RAGAS evaluation for question: {question[:80]}...")

        scores = {}

        scores["faithfulness"] = self.faithfulness(
            answer, context_chunks, openai_api_key, gemini_api_key
        )
        scores["answer_relevancy"] = self.answer_relevancy(
            question, answer, openai_api_key=openai_api_key, gemini_api_key=gemini_api_key
        )
        scores["context_precision"] = self.context_precision(
            question, context_chunks, openai_api_key, gemini_api_key
        )
        scores["context_recall"] = self.context_recall(
            question, answer, context_chunks, openai_api_key, gemini_api_key
        )

        # Overall = mean of non-error scores
        valid = [v for v in scores.values() if v >= 0]
        scores["overall"] = round(sum(valid) / len(valid), 4) if valid else -1.0

        logger.info(f"RAGAS scores: {scores}")
        return scores


# Global singleton — lazy-loaded LLMs, shared across requests
evaluator = RAGASEvaluator()
