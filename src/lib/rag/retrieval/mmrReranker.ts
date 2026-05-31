import type { FusedChunk } from './rrfFusion';
import type { FullRetrievedChunk } from './vectorSearch';

export type CandidateChunk = FusedChunk & FullRetrievedChunk;

/**
 * Computes cosine similarity between two vectors inline.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Performs Maximal Marginal Relevance (MMR) reranking to ensure diversity.
 * 
 * @param candidates The list of combined and ranked chunks (must contain embeddings)
 * @param queryEmbedding The embedding vector of the search query
 * @param lambda Relevance vs Diversity trade-off (1.0 = Max Relevance, 0.0 = Max Diversity)
 * @param topK Number of final chunks to return
 */
export function mmrRerank(
  candidates: CandidateChunk[],
  queryEmbedding: number[],
  lambda: number = 0.7,
  topK: number = 5
): CandidateChunk[] {
  if (candidates.length <= topK) return candidates;

  const selected: CandidateChunk[] = [];
  const unselected = [...candidates];

  // Precompute similarities of all candidates to the query to save CPU cycles
  const querySimMap = new Map<string, number>();
  for (const c of unselected) {
    querySimMap.set(c.id, cosineSimilarity(queryEmbedding, c.embedding));
  }

  while (selected.length < topK && unselected.length > 0) {
    let bestScore = -Infinity;
    let bestIdx = -1;

    for (let i = 0; i < unselected.length; i++) {
      const candidate = unselected[i];
      const simQuery = querySimMap.get(candidate.id) || 0;
      
      let maxSimToSelected = 0;
      
      // Find the maximum similarity to ANY already selected chunk
      for (const sel of selected) {
        const simSel = cosineSimilarity(candidate.embedding, sel.embedding);
        if (simSel > maxSimToSelected) {
          maxSimToSelected = simSel;
        }
      }

      // MMR Formula
      const mmrScore = lambda * simQuery - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    // Move the best candidate from unselected to selected
    selected.push(unselected[bestIdx]);
    unselected.splice(bestIdx, 1);
  }

  return selected;
}
