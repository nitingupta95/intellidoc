import logging
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchAny
from core.config import settings

logger = logging.getLogger(__name__)

class QdrantVectorStore:
    def __init__(self, collection_name="documents", dimension=1536):
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            port=443 if settings.QDRANT_URL.startswith("https") else 6333,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
        )
        self.collection_name = collection_name
        self.dimension = dimension
        self._ensure_collection()

    def _ensure_collection(self):
        try:
            collections = self.client.get_collections().collections
            if not any(c.name == self.collection_name for c in collections):
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.dimension, distance=Distance.COSINE),
                )
                logger.info(f"Created Qdrant collection: {self.collection_name} with dim {self.dimension}")
                
            # Always ensure the payload index exists for document_id filtering
            try:
                from qdrant_client.models import PayloadSchemaType
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.document_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                logger.info("Ensured keyword payload index for metadata.document_id")
            except Exception as index_err:
                # If index already exists or another minor error, it's safe to ignore
                logger.warning(f"Note on payload index (might already exist): {index_err}")
                
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
