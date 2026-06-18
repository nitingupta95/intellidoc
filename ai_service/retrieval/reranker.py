from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class DocumentReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self.model = None
        
    def _load_model(self):
        pass # Disabled to save memory on Render free tier
                
    def rerank(self, query: str, documents: List[Any], top_k: int = 5) -> List[Any]:
        """
        No-op reranker. Returns the top_k original documents sorted by their vector DB score.
        """
        if not documents:
            return []
            
        return documents[:top_k]

# Global instance
reranker = DocumentReranker()
