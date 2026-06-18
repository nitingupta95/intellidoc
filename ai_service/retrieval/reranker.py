from typing import List, Dict, Any
import logging
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)

class DocumentReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self.model = None
        
    def _load_model(self):
        if self.model is None:
            logger.info(f"Loading cross-encoder model for re-ranking: {self.model_name}")
            try:
                self.model = CrossEncoder(self.model_name, max_length=512)
            except Exception as e:
                logger.error(f"Failed to load reranker model: {e}")
                
    def rerank(self, query: str, documents: List[Any], top_k: int = 5) -> List[Any]:
        """
        Re-ranks a list of documents based on cross-encoder scores against the query.
        Returns the top_k scored documents.
        """
        if not documents:
            return []
            
        self._load_model()
        
        if self.model is None:
            logger.warning("Reranker model not loaded, returning original documents.")
            return documents[:top_k]
            
        # Create pairs of (query, document_text)
        pairs = []
        for doc in documents:
            # Handle Qdrant ScoredPoint objects
            if hasattr(doc, 'payload'):
                text = doc.payload.get("content", "")
            else:
                text = str(doc)
            pairs.append([query, text])
            
        try:
            scores = self.model.predict(pairs)
            
            # Attach scores to documents and sort
            scored_docs = list(zip(documents, scores))
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            
            # We don't overwrite Qdrant scores completely, but we rely on the reranker's ordering.
            # Just return the top_k original objects in their new order.
            return [doc for doc, score in scored_docs[:top_k]]
        except Exception as e:
            logger.error(f"Error during re-ranking: {e}")
            return documents[:top_k]

# Global instance
reranker = DocumentReranker()
