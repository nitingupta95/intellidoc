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
                model=settings.GEMINI_EMBEDDING_MODEL,
                google_api_key=gemini_api_key,
                output_dimensionality=settings.GEMINI_EMBEDDING_DIM,
            ), "gemini", settings.GEMINI_EMBEDDING_DIM

        # Fallback
        if self.default_embeddings:
            return self.default_embeddings, "openai", 1536
            
        raise ValueError("No valid API key provided for embeddings")

    def _get_gemini_fallback(self, gemini_api_key: str = None, openai_api_key: str = None):
        """Build a Gemini embedding instance for fallback.

        A user's own exhausted OpenAI key never falls back to the SYSTEM Gemini key.
        """
        key = gemini_api_key or (None if openai_api_key else settings.GEMINI_API_KEY)
        if not key:
            return None
        return GoogleGenerativeAIEmbeddings(
            model=settings.GEMINI_EMBEDDING_MODEL,
            google_api_key=key,
            output_dimensionality=settings.GEMINI_EMBEDDING_DIM,
        )

    def _is_openai_quota_error(self, exc: Exception) -> bool:
        """Return True if the exception is an OpenAI 429 / credit-exhausted error."""
        exc_str = str(exc).lower()
        return (
            "429" in exc_str
            or "insufficient_quota" in exc_str
            or "credit_balance_exhausted" in exc_str
            or "rate_limit" in exc_str
        )

    def embed_documents(self, texts: list[str], openai_api_key: str = None, gemini_api_key: str = None) -> tuple[list[list[float]], str, int]:
        emb, provider, dim = self.get_embeddings_and_provider(openai_api_key, gemini_api_key)
        try:
            return emb.embed_documents(texts), provider, dim
        except Exception as exc:
            if provider == "openai" and self._is_openai_quota_error(exc):
                fallback = self._get_gemini_fallback(gemini_api_key, openai_api_key)
                if fallback:
                    logger.warning(
                        "OpenAI embedding failed (quota exhausted) — falling back to Gemini"
                    )
                    return fallback.embed_documents(texts), "gemini", settings.GEMINI_EMBEDDING_DIM
            raise
        
    def embed_query(self, text: str, openai_api_key: str = None, gemini_api_key: str = None) -> tuple[list[float], str, int]:
        emb, provider, dim = self.get_embeddings_and_provider(openai_api_key, gemini_api_key)
        try:
            return emb.embed_query(text), provider, dim
        except Exception as exc:
            if provider == "openai" and self._is_openai_quota_error(exc):
                fallback = self._get_gemini_fallback(gemini_api_key, openai_api_key)
                if fallback:
                    logger.warning(
                        "OpenAI embedding failed (quota exhausted) — falling back to Gemini"
                    )
                    return fallback.embed_query(text), "gemini", settings.GEMINI_EMBEDDING_DIM
            raise
