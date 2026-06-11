import logging
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchAny
from core.config import settings

logger = logging.getLogger(__name__)

class QdrantVectorStore:
    def __init__(self, collection_name="documents"):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.collection_name = collection_name
        self._ensure_collection()

    def _ensure_collection(self):
        try:
            collections = self.client.get_collections().collections
            if not any(c.name == self.collection_name for c in collections):
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
                logger.info(f"Created Qdrant collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection: {e}")

    def upsert_chunks(self, chunks: list[dict], embeddings: list[list[float]]):
        if not chunks:
            logger.warning("No chunks provided to upsert. Skipping.")
            return

        points = []
        for idx, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload=chunk
            ))
        
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        
    def search(self, query_vector: list[float], limit: int = 5, document_ids: list[str] = None):
        query_filter = None
        if document_ids:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="metadata.document_id",
                        match=MatchAny(any=document_ids)
                    )
                ]
            )
            
        return self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=query_filter,
            limit=limit
        ).points
