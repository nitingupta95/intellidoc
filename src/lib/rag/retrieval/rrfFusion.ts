import type { BM25RetrievedChunk } from './bm25';
import type { RetrievedChunk } from '../../redis/vectorStore';
import type { FullRetrievedChunk } from './vectorSearch';

export interface FusedChunk extends RetrievedChunk {
  rrfScore: number;
  bm25Score?: number;
  embedding?: number[];
}

/**
 * Performs Reciprocal Rank Fusion on two ranked lists of chunks.
 * Merges chunks based on their unique 'id' and sorts the unified list by RRF score.
 * 
 * @param semanticRanking Best-first sorted semantic chunks
 * @param bm25Ranking Best-first sorted BM25 chunks
 * @param k Hyperparameter for RRF formula (default 60 is an industry standard)
 */
export function reciprocalRankFusion(
  semanticRanking: FullRetrievedChunk[],
  bm25Ranking: BM25RetrievedChunk[],
  k: number = 60
): FusedChunk[] {
  const scoreMap = new Map<string, FusedChunk>();

  // Process semantic ranking
  for (let i = 0; i < semanticRanking.length; i++) {
    const chunk = semanticRanking[i];
    const rank = i + 1;
    const rrfContribution = 1 / (k + rank);

    scoreMap.set(chunk.id, {
      ...chunk,
      rrfScore: rrfContribution,
      embedding: chunk.embedding,
    });
  }

  // Process BM25 ranking
  for (let i = 0; i < bm25Ranking.length; i++) {
    const chunk = bm25Ranking[i];
    const rank = i + 1;
    const rrfContribution = 1 / (k + rank);

    const existing = scoreMap.get(chunk.id);
    if (existing) {
      existing.rrfScore += rrfContribution;
      existing.bm25Score = chunk.bm25Score;
    } else {
      scoreMap.set(chunk.id, {
        ...chunk,
        rrfScore: rrfContribution,
        bm25Score: chunk.bm25Score
      });
    }
  }

  // Convert map to array and sort by rrfScore descending
  return Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}
