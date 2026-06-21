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
                
            # Always ensure the payload index exists for workspace_id filtering
            try:
                from qdrant_client.models import PayloadSchemaType
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.workspace_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.knowledge_base_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.document_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.chunk_hash",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                logger.info("Ensured keyword payload indices")
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
        
    def copy_duplicate_vectors(self, duplicate_chunks: list[dict], workspace_id: str) -> list[dict]:
        """Copies existing vectors from Qdrant and upserts them. Returns any chunks that could not be found."""
        if not duplicate_chunks:
            return []
            
        # Extract unique hashes we need to find
        hashes = list({c["metadata"]["chunk_hash"] for c in duplicate_chunks if "chunk_hash" in c.get("metadata", {})})
        if not hashes:
            return duplicate_chunks
            
        try:
            # Fetch existing vectors from Qdrant with pagination to ensure we don't miss any hashes
            records = []
            next_page = None
            while True:
                res, next_page = self.client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=Filter(must=[
                        FieldCondition(key="metadata.workspace_id", match=MatchAny(any=[workspace_id])),
                        FieldCondition(key="metadata.chunk_hash", match=MatchAny(any=hashes))
                    ]),
                    with_vectors=True,
                    limit=1000,
                    offset=next_page
                )
                records.extend(res)
                if not next_page:
                    break
            
            # Map hash to its vector
            hash_to_vector = {}
            for record in records:
                if record.vector:
                    h = record.payload.get("metadata", {}).get("chunk_hash")
                    if h and h not in hash_to_vector:
                        hash_to_vector[h] = record.vector
                        
            # Create new points for the new document using the copied vectors
            points_to_upsert = []
            missing_chunks = []
            
            for chunk in duplicate_chunks:
                h = chunk.get("metadata", {}).get("chunk_hash")
                if h in hash_to_vector:
                    points_to_upsert.append(PointStruct(
                        id=str(uuid.uuid4()),
                        vector=hash_to_vector[h],
                        payload=chunk
                    ))
                else:
                    logger.warning(f"Could not find existing Qdrant vector for hash {h} in collection {self.collection_name}")
                    missing_chunks.append(chunk)
                    
            if points_to_upsert:
                self.client.upsert(collection_name=self.collection_name, points=points_to_upsert)
                logger.info(f"Copied {len(points_to_upsert)} duplicate vectors in Qdrant")
                
            return missing_chunks
        except Exception as e:
            logger.error(f"Error copying duplicate vectors in Qdrant: {e}")
            # If Qdrant fails, we must fall back to re-embedding all of them to prevent data loss
            return duplicate_chunks
        
    def search(self, query_vector: list[float], workspace_id: str, knowledge_base_id: str = None, document_ids: list[str] = None, limit: int = 5):
        must_conditions = [
            FieldCondition(
                key="metadata.workspace_id",
                match=MatchAny(any=[workspace_id])
            )
        ]
        
        if document_ids is not None:
            # Only search within the provided document_ids (this is the most precise filter)
            must_conditions.append(
                FieldCondition(
                    key="metadata.document_id",
                    match=MatchAny(any=document_ids)
                )
            )
        elif knowledge_base_id:
            must_conditions.append(
                FieldCondition(
                    key="metadata.knowledge_base_id",
                    match=MatchAny(any=[knowledge_base_id])
                )
            )

        query_filter = Filter(must=must_conditions)
            
        if hasattr(self.client, "query_points"):
            return self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=limit
            ).points
        else:
            return self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit
            )
