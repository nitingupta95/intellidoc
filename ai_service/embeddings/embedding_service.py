from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        # We will keep text-embedding-3-small as primary fallback if available
        self.default_embeddings = None
        if settings.OPENAI_API_KEY:
            self.default_embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=settings.OPENAI_API_KEY
            )

    def get_embeddings_and_provider(self, openai_api_key: str = None, gemini_api_key: str = None):
        """Returns (embedding_instance, provider_name, dimension)"""
        # If OpenAI key provided explicitly
        if openai_api_key:
            return OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=openai_api_key
            ), "openai", 1536
            
        # If Gemini key provided explicitly
        if gemini_api_key:
            return GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=gemini_api_key
            ), "gemini", 768

        # Fallback
        if self.default_embeddings:
            return self.default_embeddings, "openai", 1536
            
        raise ValueError("No valid API key provided for embeddings")

    def embed_documents(self, texts: list[str], openai_api_key: str = None, gemini_api_key: str = None) -> tuple[list[list[float]], str, int]:
        emb, provider, dim = self.get_embeddings_and_provider(openai_api_key, gemini_api_key)
        return emb.embed_documents(texts), provider, dim
        
    def embed_query(self, text: str, openai_api_key: str = None, gemini_api_key: str = None) -> tuple[list[float], str, int]:
        emb, provider, dim = self.get_embeddings_and_provider(openai_api_key, gemini_api_key)
        return emb.embed_query(text), provider, dim
