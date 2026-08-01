import logging
import uuid
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchAny
from core.config import settings

logger = logging.getLogger(__name__)

class QdrantVectorStore:
    def __init__(self, collection_name="documents", dimension=1536):
        self.client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
        )
        self.collection_name = collection_name
        self.dimension = dimension
        # NOTE: _ensure_collection is now async, so we must call it explicitly after init if needed, 
        # but for Phase 7 we will move initialization to app startup.

    async def _ensure_collection(self):
        try:
            collections = (await self.client.get_collections()).collections
            if not any(c.name == self.collection_name for c in collections):
                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.dimension, distance=Distance.COSINE),
                )
                logger.info(f"Created Qdrant collection: {self.collection_name} with dim {self.dimension}")
                
            # Always ensure the payload index exists for workspace_id filtering
            try:
                from qdrant_client.models import PayloadSchemaType
                await self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.workspace_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                await self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.knowledge_base_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                await self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.document_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                logger.info("Ensured keyword payload indices")
            except Exception as index_err:
                # If index already exists or another minor error, it's safe to ignore
                logger.warning(f"Note on payload index (might already exist): {index_err}")
                
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection: {e}")

    async def upsert_chunks(self, chunks: list[dict], embeddings: list[list[float]]):
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
        
        await self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        
    async def search(
        self, 
        query_vector: list[float], 
        workspace_id: str, 
        knowledge_base_id: str = None, 
        document_ids: list[str] = None, 
        limit: int = 5,
        query_text: str = None,
        team_id: str = None,
        department: str = None,
        project: str = None
    ):
        must_conditions = [
            FieldCondition(
                key="metadata.workspace_id",
                match=MatchAny(any=[workspace_id])
            )
        ]
        
        if document_ids is not None:
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

        # Extended metadata filters
        if team_id:
            must_conditions.append(FieldCondition(key="metadata.team_id", match=MatchAny(any=[team_id])))
        if department:
            must_conditions.append(FieldCondition(key="metadata.department", match=MatchAny(any=[department])))
        if project:
            must_conditions.append(FieldCondition(key="metadata.project", match=MatchAny(any=[project])))

        query_filter = Filter(must=must_conditions)
            
        if hasattr(self.client, "query_points"):
            # If query_text is provided, we can simulate hybrid search (BM25/Sparse + Dense)
            # NOTE: Requires setting up a sparse vector index in Qdrant and a sparse embedding model (e.g. SPLADE/fastembed).
            # This is a skeleton of the hybrid query using prefetch.
            prefetch = None
            # if query_text and SPARSE_MODEL_AVAILABLE:
            #     sparse_vector = compute_sparse_vector(query_text)
            #     prefetch = [
            #         qmodels.Prefetch(
            #             query=sparse_vector,
            #             using="sparse",
            #             filter=query_filter,
            #             limit=limit * 2
            #         ),
            #         qmodels.Prefetch(
            #             query=query_vector,
            #             using="default",
            #             filter=query_filter,
            #             limit=limit * 2
            #         )
            #     ]
            
            result = await self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                prefetch=prefetch,
                query_filter=query_filter,
                limit=limit
            )
            return result.points
        else:
            result = await self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit
            )
            return result

    async def scroll_chunks(
        self,
        workspace_id: str,
        knowledge_base_id: str = None,
        document_ids: list[str] = None,
        limit: int = 20,
        team_id: str = None,
        department: str = None,
        project: str = None
    ):
        must_conditions = [
            FieldCondition(
                key="metadata.workspace_id",
                match=MatchAny(any=[workspace_id])
            )
        ]
        
        if document_ids is not None:
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

        if team_id:
            must_conditions.append(FieldCondition(key="metadata.team_id", match=MatchAny(any=[team_id])))
        if department:
            must_conditions.append(FieldCondition(key="metadata.department", match=MatchAny(any=[department])))
        if project:
            must_conditions.append(FieldCondition(key="metadata.project", match=MatchAny(any=[project])))

        query_filter = Filter(must=must_conditions)
        
        result, _ = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False
        )
        return result
