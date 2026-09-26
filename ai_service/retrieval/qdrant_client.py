"""
Qdrant vector store client with per-document floor-fill retrieval.

Architecture (retrieval floor change)
──────────────────────────────────────
The normal global top-k search can starve documents that are semantically
farther from the raw query embedding — every slot goes to the one nearest doc.

Fix: after the global search, inspect which doc_ids in the active scope are
*unrepresented* in the result set, then run a small targeted search (top-N)
scoped to each missing doc via a Qdrant MatchAny filter on metadata.document_id.
Results are merged, deduplicated, and capped at RETRIEVAL_TOTAL_CAP.

Feature flags (core/config.py):
  RETRIEVAL_PER_DOC_FLOOR  int   (default 2)  — min chunks per doc; 0 = off
  RETRIEVAL_TOTAL_CAP      int   (default 15) — hard ceiling after merge
  RETRIEVAL_DEBUG          bool  (default True)— structured doc-coverage log
"""

import asyncio
import logging
import uuid
from typing import List, Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    PointStruct,
    VectorParams,
)

from core.config import settings

logger = logging.getLogger(__name__)


class QdrantVectorStore:
    def __init__(self, collection_name: str = "documents", dimension: int = 1536):
        self.client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
        )
        self.collection_name = collection_name
        self.dimension = dimension

    # ─────────────────────────────────────────────────────────────────────────
    # Collection / index bootstrap
    # ─────────────────────────────────────────────────────────────────────────

    async def _ensure_collection(self):
        try:
            collections = (await self.client.get_collections()).collections
            if not any(c.name == self.collection_name for c in collections):
                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.dimension, distance=Distance.COSINE),
                )
                logger.info(
                    "Created Qdrant collection: %s with dim %d",
                    self.collection_name, self.dimension,
                )

            # Always ensure payload indices exist
            try:
                from qdrant_client.models import PayloadSchemaType
                for field in (
                    "metadata.workspace_id",
                    "metadata.knowledge_base_id",
                    "metadata.document_id",
                ):
                    await self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field,
                        field_schema=PayloadSchemaType.KEYWORD,
                    )
                logger.info("Ensured keyword payload indices")
            except Exception as index_err:
                logger.warning("Note on payload index (might already exist): %s", index_err)

        except Exception as e:
            logger.error("Error ensuring Qdrant collection: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Upsert
    # ─────────────────────────────────────────────────────────────────────────

    async def upsert_chunks(self, chunks: list[dict], embeddings: list[list[float]]):
        if not chunks:
            logger.warning("No chunks provided to upsert. Skipping.")
            return
        points = [
            PointStruct(id=str(uuid.uuid4()), vector=vec, payload=chunk)
            for chunk, vec in zip(chunks, embeddings)
        ]
        await self.client.upsert(collection_name=self.collection_name, points=points)

    # ─────────────────────────────────────────────────────────────────────────
    # Filter builder (DRY helper shared by search + floor-fill)
    # ─────────────────────────────────────────────────────────────────────────

    def _build_base_filter(
        self,
        workspace_id: str,
        knowledge_base_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        team_id: Optional[str] = None,
        department: Optional[str] = None,
        project: Optional[str] = None,
        # Override doc scope for targeted per-doc queries
        override_doc_ids: Optional[List[str]] = None,
    ) -> Filter:
        must = [
            FieldCondition(key="metadata.workspace_id", match=MatchAny(any=[workspace_id]))
        ]

        # Use override_doc_ids when doing targeted per-doc floor-fill queries
        effective_doc_ids = override_doc_ids if override_doc_ids is not None else document_ids

        if effective_doc_ids is not None:
            must.append(
                FieldCondition(
                    key="metadata.document_id",
                    match=MatchAny(any=effective_doc_ids),
                )
            )
        elif knowledge_base_id:
            must.append(
                FieldCondition(
                    key="metadata.knowledge_base_id",
                    match=MatchAny(any=[knowledge_base_id]),
                )
            )

        if team_id:
            must.append(FieldCondition(key="metadata.team_id", match=MatchAny(any=[team_id])))
        if department:
            must.append(FieldCondition(key="metadata.department", match=MatchAny(any=[department])))
        if project:
            must.append(FieldCondition(key="metadata.project", match=MatchAny(any=[project])))

        return Filter(must=must)

    # ─────────────────────────────────────────────────────────────────────────
    # Discover all distinct doc_ids currently in scope (for floor-fill)
    # ─────────────────────────────────────────────────────────────────────────

    async def _fetch_distinct_doc_ids(
        self,
        workspace_id: str,
        knowledge_base_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        team_id: Optional[str] = None,
        department: Optional[str] = None,
        project: Optional[str] = None,
    ) -> List[str]:
        """
        If document_ids is already provided by the caller, return it directly
        (the caller already knows the exact scope).  Otherwise scroll a small
        sample from Qdrant to discover which doc_ids exist in the KB.
        """
        if document_ids is not None:
            return list(document_ids)

        query_filter = self._build_base_filter(
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            document_ids=None,
            team_id=team_id,
            department=department,
            project=project,
        )
        # Scroll a sample large enough to discover unique doc_ids without
        # fetching the entire collection.  200 points is cheap and sufficient
        # for typical KB sizes (< 50 docs × chunks).
        try:
            points, _ = await self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=200,
                with_payload=True,
                with_vectors=False,
            )
            ids = list({
                p.payload.get("metadata", {}).get("document_id")
                for p in points
                if p.payload and p.payload.get("metadata", {}).get("document_id")
            })
            return ids
        except Exception as exc:
            logger.warning("_fetch_distinct_doc_ids failed: %s — skipping floor-fill", exc)
            return []

    # ─────────────────────────────────────────────────────────────────────────
    # Core vector query (shared by search and floor-fill)
    # ─────────────────────────────────────────────────────────────────────────

    async def _vector_query(self, query_vector: list[float], query_filter: Filter, limit: int):
        """Run a single vector query with the given filter and limit."""
        if hasattr(self.client, "query_points"):
            result = await self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                prefetch=None,
                query_filter=query_filter,
                limit=limit,
            )
            return result.points
        else:
            result = await self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit,
            )
            return result

    # ─────────────────────────────────────────────────────────────────────────
    # Public search (with per-doc floor-fill)
    # ─────────────────────────────────────────────────────────────────────────

    async def search(
        self,
        query_vector: list[float],
        workspace_id: str,
        knowledge_base_id: str = None,
        document_ids: list[str] = None,
        limit: int = 15,
        query_text: str = None,   # reserved for future sparse/hybrid use
        team_id: str = None,
        department: str = None,
        project: str = None,
        per_doc_floor: int = None,   # None = use settings default
        total_cap: int = None,       # None = use settings default
    ):
        """
        Vector search with per-document floor-fill guarantee.

        Step 1 — Global top-k search (unchanged behaviour).
        Step 2 — Identify which doc_ids are unrepresented in the result set.
        Step 3 — For each missing doc, run a small targeted search (top
                  per_doc_floor) scoped to that doc_id and append results.
        Step 4 — Deduplicate by point id, then cap at total_cap.
        Step 5 — Emit doc-coverage debug log if RETRIEVAL_DEBUG=True.
        """
        _floor = settings.RETRIEVAL_PER_DOC_FLOOR if per_doc_floor is None else per_doc_floor
        _cap   = settings.RETRIEVAL_TOTAL_CAP     if total_cap is None else total_cap

        # ── Step 1: global top-k ──────────────────────────────────────────────
        global_filter = self._build_base_filter(
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            document_ids=document_ids,
            team_id=team_id,
            department=department,
            project=project,
        )
        global_results = await self._vector_query(query_vector, global_filter, limit)

        # ── Step 2: identify unrepresented docs ───────────────────────────────
        if _floor > 0:
            # Collect doc_ids already present in global results
            represented: set = set()
            for p in global_results:
                doc_id = (p.payload or {}).get("metadata", {}).get("document_id")
                if doc_id:
                    represented.add(doc_id)

            # Discover all doc_ids in scope
            all_doc_ids = await self._fetch_distinct_doc_ids(
                workspace_id=workspace_id,
                knowledge_base_id=knowledge_base_id,
                document_ids=document_ids,
                team_id=team_id,
                department=department,
                project=project,
            )
            missing_docs = [d for d in all_doc_ids if d not in represented]

            # ── Step 3: floor-fill for each missing doc ────────────────────────
            if missing_docs:
                logger.debug(
                    "RETRIEVAL floor-fill: %d docs unrepresented (%s) — fetching top-%d each",
                    len(missing_docs), missing_docs, _floor,
                )
                floor_tasks = [
                    self._vector_query(
                        query_vector,
                        self._build_base_filter(
                            workspace_id=workspace_id,
                            knowledge_base_id=knowledge_base_id,
                            document_ids=document_ids,
                            team_id=team_id,
                            department=department,
                            project=project,
                            override_doc_ids=[doc_id],
                        ),
                        _floor,
                    )
                    for doc_id in missing_docs
                ]
                floor_batches = await asyncio.gather(*floor_tasks, return_exceptions=True)

                seen_ids: set = {getattr(p, "id", None) for p in global_results}
                for batch in floor_batches:
                    if isinstance(batch, Exception):
                        logger.warning("RETRIEVAL floor-fill query failed: %s", batch)
                        continue
                    for point in batch:
                        pid = getattr(point, "id", None)
                        if pid not in seen_ids:
                            seen_ids.add(pid)
                            global_results.append(point)

        # ── Step 4: cap total results ─────────────────────────────────────────
        # Sort by score descending so we keep the highest-quality chunks when
        # we have to trim. Floor-fill chunks have real scores from Qdrant so
        # they compete fairly here.
        global_results.sort(key=lambda p: getattr(p, "score", 0.0), reverse=True)
        final_results = global_results[:_cap]

        # ── Step 5: debug coverage log ────────────────────────────────────────
        if settings.RETRIEVAL_DEBUG:
            doc_coverage: dict = {}
            for p in final_results:
                doc_id = (p.payload or {}).get("metadata", {}).get("document_id", "unknown")
                doc_coverage[doc_id] = doc_coverage.get(doc_id, 0) + 1
            logger.info(
                "RETRIEVAL doc_coverage_log: %s",
                {
                    "event":        "doc_coverage_log",
                    "total_chunks": len(final_results),
                    "docs_covered": len(doc_coverage),
                    "coverage":     doc_coverage,   # {doc_id: chunk_count}
                    "floor_used":   _floor,
                    "cap_used":     _cap,
                },
            )

        return final_results

    # ─────────────────────────────────────────────────────────────────────────
    # Scroll (unchanged — used for summary requests)
    # ─────────────────────────────────────────────────────────────────────────

    async def scroll_chunks(
        self,
        workspace_id: str,
        knowledge_base_id: str = None,
        document_ids: list[str] = None,
        limit: int = 20,
        team_id: str = None,
        department: str = None,
        project: str = None,
    ):
        query_filter = self._build_base_filter(
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            document_ids=document_ids,
            team_id=team_id,
            department=department,
            project=project,
        )
        result, _ = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return result
