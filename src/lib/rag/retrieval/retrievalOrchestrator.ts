import { vectorSearch } from './vectorSearch';
import { scoreBM25 } from './bm25';
import { reciprocalRankFusion } from './rrfFusion';
import { mmrRerank, type CandidateChunk } from './mmrReranker';
import pino from 'pino';

const logger = pino({ name: 'retrieval-orchestrator' });

/**
 * Executes the full Hybrid Retrieval Pipeline:
 * 1. Semantic search (Vector KNN)
 * 2. Lexical search (BM25 over semantic chunks)
 * 3. RRF Fusion (Reciprocal Rank Fusion)
 * 4. MMR Reranking (Maximal Marginal Relevance)
 */
export async function hybridRetrieve(
  query: string,
  queryEmbedding: number[],
  docIds: string[],
  userId: string
) {
  const startTime = Date.now();
  
  if (!docIds || docIds.length === 0) {
    logger.info('No docIds provided for retrieval, returning empty array.');
    return [];
  }

  try {
    // 1. Vector Search (Top 20)
    const semanticRanking = await vectorSearch(queryEmbedding, docIds, userId, 20);
    
    if (semanticRanking.length === 0) {
      return [];
    }

    // 2. BM25 Scoring
    // We score the semantically retrieved chunks for speed, avoiding a full-corpus scan
    const bm25Scored = await scoreBM25(query, semanticRanking, docIds, userId);
    
    // Sort BM25 chunks best-first (highest score first)
    const bm25Ranking = [...bm25Scored].sort((a, b) => b.bm25Score - a.bm25Score);

    // 3. RRF Fusion
    const fusedRanking = reciprocalRankFusion(semanticRanking, bm25Ranking);

    // Filter to valid CandidateChunks (those with embeddings)
    const validCandidates = fusedRanking.filter(c => c.embedding !== undefined) as CandidateChunk[];

    // 4. MMR Reranking
    // Extract the top 5 most diverse yet relevant chunks
    const finalChunks = mmrRerank(validCandidates, queryEmbedding, 0.7, 5);

    const retrievalMs = Date.now() - startTime;
    logger.info(
      {
        retrieval_ms: retrievalMs,
        semantic_count: semanticRanking.length,
        after_mmr_count: finalChunks.length
      },
      'Hybrid Retrieval Pipeline Completed'
    );

    // Clean up embedding vectors from final output to save memory
    return finalChunks.map(chunk => {
      const { embedding, ...rest } = chunk;
      return rest;
    });

  } catch (error) {
    logger.error({ error, query, userId }, 'Hybrid Retrieval failed');
    throw error;
  }
}
