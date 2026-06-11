from langchain_openai import OpenAIEmbeddings
from core.config import settings

class EmbeddingService:
    def __init__(self):
        # We will use text-embedding-3-small as primary embedding model
        self.default_embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.OPENAI_API_KEY
        )

    def _get_embeddings(self, api_key: str = None):
        if api_key:
            return OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=api_key
            )
        return self.default_embeddings

    def embed_documents(self, texts: list[str], api_key: str = None) -> list[list[float]]:
        emb = self._get_embeddings(api_key)
        return emb.embed_documents(texts)
        
    def embed_query(self, text: str, api_key: str = None) -> list[float]:
        emb = self._get_embeddings(api_key)
        return emb.embed_query(text)
