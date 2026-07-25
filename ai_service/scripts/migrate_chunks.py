import asyncio
import logging
from core.config import settings
from retrieval.qdrant_client import QdrantVectorStore
from embeddings.embedding_service import EmbeddingService
from embeddings.semantic_chunker import SemanticChunker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate_chunks():
    """
    Migration Script for Phase 3:
    Re-chunks existing documents from ~1000 tokens down to 300-500 tokens.
    
    WARNING: This script pulls all payloads from Qdrant, stitches the text back 
    together per document, and re-runs the chunking and embedding pipeline.
    It may consume significant OpenAI credits and time for large knowledge bases.
    """
    logger.info("Starting chunk migration script...")
    
    # 1. Initialize services
    # NOTE: You may need to adapt dimension and provider if you use multiple
    provider = "openai"
    dimension = 1536
    vs = QdrantVectorStore(collection_name=f"documents_{provider}", dimension=dimension)
    
    embedding_svc = EmbeddingService()
    # The new chunker will use 400 chunk size and 50 overlap
    chunker = SemanticChunker(chunk_size=400, chunk_overlap=50)
    
    # 2. Fetch all points from Qdrant (this assumes a reasonably sized dataset; 
    # for massive datasets, you'd need scroll API)
    logger.info("Fetching existing vectors...")
    scroll_result, next_page_offset = vs.client.scroll(
        collection_name=vs.collection_name,
        limit=10000,
        with_payload=True,
        with_vectors=False
    )
    
    if not scroll_result:
        logger.info("No documents found in Qdrant to migrate.")
        return

    # Group by document_id
    docs = {}
    for point in scroll_result:
        payload = point.payload or {}
        metadata = payload.get("metadata", {})
        doc_id = metadata.get("document_id")
        
        if not doc_id:
            continue
            
        if doc_id not in docs:
            docs[doc_id] = {
                "text_parts": [],
                "metadata": metadata
            }
        docs[doc_id]["text_parts"].append(payload.get("content", ""))
        
    logger.info(f"Found {len(docs)} unique documents to migrate.")
    
    # 3. Process each document
    for doc_id, doc_data in docs.items():
        logger.info(f"Migrating document: {doc_id}")
        full_text = " ".join(doc_data["text_parts"])
        
        # Simulate a parsed element
        elements = [{
            "type": "text",
            "text": full_text,
            "metadata": doc_data["metadata"]
        }]
        
        # Chunk
        new_chunks = chunker.chunk_documents(elements)
        logger.info(f"Generated {len(new_chunks)} new chunks for document {doc_id}.")
        
        # Embed
        texts = [c["content"] for c in new_chunks]
        embeddings, prov, dim = embedding_svc.embed_documents(texts)
        
        # Note: You should ideally delete the old chunks for this document first
        # from qdrant_client import models
        # vs.client.delete(
        #     collection_name=vs.collection_name,
        #     points_selector=models.Filter(must=[
        #         models.FieldCondition(key="metadata.document_id", match=models.MatchValue(value=doc_id))
        #     ])
        # )
        
        # Upsert new chunks
        vs.upsert_chunks(new_chunks, embeddings)
        logger.info(f"Successfully migrated {doc_id}.")

    logger.info("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate_chunks())
