from langchain_openai import OpenAIEmbeddings
from core.config import settings

class EmbeddingService:
    def __init__(self):
        # We will use text-embedding-3-small as primary embedding model
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.OPENAI_API_KEY
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.embeddings.embed_documents(texts)
        
    def embed_query(self, text: str) -> list[float]:
        return self.embeddings.embed_query(text)
