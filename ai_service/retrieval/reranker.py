"""
MMR (Maximal Marginal Relevance) reranker for IntelliDoc retrieval.

Replaces the previous no-op slice.  Pure Python — no additional dependencies.

MMR selects results iteratively:
  1. Start with the highest-scoring (most relevant) chunk.
  2. At each step pick the chunk that maximises:
       lambda * relevance_score  -  (1 - lambda) * max_similarity_to_selected
  3. Repeat until top_k chunks are selected.

"similarity_to_selected" uses the Qdrant cosine score between chunks as a
proxy for textual overlap.  Since we don't have the raw vectors at rerank time,
we approximate similarity between two chunks as:
    sim(a, b) = 1 - |score_a - score_b| / max_score
                * text_overlap_factor(a, b)
where text_overlap_factor is a lightweight word-overlap ratio (Jaccard on
whitespace tokens, truncated to the first 60 words for speed).

This approach is fast, zero-cost, and meaningfully reduces same-document
cluster dominance without requiring a second embedding call.

Feature flag: RETRIEVAL_MMR_LAMBDA (float, default 0.7).
  - 1.0 = pure similarity (same as old top-k slice)
  - 0.0 = pure diversity (maximise difference only)
  - 0.7 = recommended — accurate but diverse
"""

from __future__ import annotations

import logging
from typing import Any, List, Optional

from core.config import settings

logger = logging.getLogger(__name__)


def _jaccard_word_overlap(text_a: str, text_b: str, max_words: int = 60) -> float:
    """
    Lightweight word-overlap ratio (Jaccard) between two text strings.
    Uses the first `max_words` whitespace tokens of each text for speed.
    Returns 0.0–1.0.
    """
    tokens_a = set(text_a.lower().split()[:max_words])
    tokens_b = set(text_b.lower().split()[:max_words])
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union else 0.0


def _chunk_text(point: Any) -> str:
    """Extract text content from a Qdrant ScoredPoint or citation dict."""
    if hasattr(point, "payload") and point.payload:
        return point.payload.get("content", "")
    if isinstance(point, dict):
        return point.get("full_text") or point.get("text_snippet", "")
    return ""


def _chunk_score(point: Any) -> float:
    """Extract the Qdrant cosine similarity score."""
    return float(getattr(point, "score", 0.0))


class DocumentReranker:
    """
    MMR reranker.  Operates on Qdrant ScoredPoints (or any object with
    .score and .payload.content).  No external model required.
    """

    def __init__(self, mmr_lambda: Optional[float] = None):
        # Lambda can be overridden at construction time for testing;
        # otherwise it is read from settings at call time so hot-config changes
        # (e.g. via env reload) take effect without a restart.
        self._lambda_override = mmr_lambda

    def _lambda(self) -> float:
        if self._lambda_override is not None:
            return self._lambda_override
        return settings.RETRIEVAL_MMR_LAMBDA

    def rerank(self, query: str, documents: List[Any], top_k: int = 5) -> List[Any]:
        """
        MMR rerank.

        Parameters
        ----------
        query     : the user query string (reserved for future dense-MMR; not
                    used in the score-proxy implementation)
        documents : list of Qdrant ScoredPoints
        top_k     : maximum number of results to return

        Returns
        -------
        List of up to top_k documents in MMR order (most relevant + diverse first).
        """
        if not documents:
            return []

        lam = self._lambda()

        # Fast path: if lambda=1.0 (pure similarity) or only 1 candidate, skip MMR
        if lam >= 1.0 or len(documents) == 1:
            return documents[:top_k]

        scores = [_chunk_score(d) for d in documents]
        texts  = [_chunk_text(d)  for d in documents]
        max_score = max(scores) if scores else 1.0

        selected_indices: List[int] = []
        remaining = list(range(len(documents)))

        while remaining and len(selected_indices) < top_k:
            best_idx: Optional[int] = None
            best_mmr: float = float("-inf")

            for idx in remaining:
                relevance = scores[idx]

                # Diversity penalty = max similarity to any already-selected chunk
                if not selected_indices:
                    diversity_penalty = 0.0
                else:
                    sims = []
                    for sel_idx in selected_indices:
                        # Score-proximity proxy
                        score_diff = abs(scores[idx] - scores[sel_idx]) / (max_score + 1e-9)
                        # Text-overlap proxy
                        jaccard = _jaccard_word_overlap(texts[idx], texts[sel_idx])
                        # Combined: higher = more similar = worse for diversity
                        sims.append((1.0 - score_diff) * 0.4 + jaccard * 0.6)
                    diversity_penalty = max(sims)

                mmr_score = lam * relevance - (1.0 - lam) * diversity_penalty
                if mmr_score > best_mmr:
                    best_mmr = mmr_score
                    best_idx = idx

            if best_idx is None:
                break
            selected_indices.append(best_idx)
            remaining.remove(best_idx)

        result = [documents[i] for i in selected_indices]

        if settings.RETRIEVAL_DEBUG:
            doc_ids = []
            for d in result:
                if hasattr(d, "payload") and d.payload:
                    doc_ids.append(d.payload.get("metadata", {}).get("document_id", "?"))
            logger.debug(
                "MMR rerank: lambda=%.2f in=%d out=%d doc_ids=%s",
                lam, len(documents), len(result), doc_ids,
            )

        return result


# Global instance — lambda read from settings at call time
reranker = DocumentReranker()
