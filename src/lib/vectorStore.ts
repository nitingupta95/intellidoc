import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../env';

export const qdrant = new QdrantClient({
  url: env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export type ChunkResult = {
  id: string;
  docId: string;
  pageNumber?: number;
  text: string;
};

export async function retrieveChunks(query: string, docIds: string[]): Promise<ChunkResult[]> {
  if (!docIds || docIds.length === 0) {
    return [];
  }

  try {
    const aiServiceUrl = env.AI_SERVICE_URL;
    const response = await fetch(`${aiServiceUrl}/api/v1/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        document_ids: docIds,
        limit: 5
      })
    });

    if (!response.ok) {
      console.error('Failed to retrieve chunks from AI service:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.chunks as ChunkResult[];
  } catch (error) {
    console.error('Error calling AI service for chunks:', error);
    return [];
  }
}
