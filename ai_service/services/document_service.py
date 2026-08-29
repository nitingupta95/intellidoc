import logging
import os
import tempfile
import boto3
import httpx
from typing import Optional
from core.config import settings
from parsers.document_parser import DocumentParser
from embeddings.semantic_chunker import SemanticChunker
from embeddings.embedding_service import EmbeddingService
from core.dependencies import get_vector_store

logger = logging.getLogger(__name__)

parser = DocumentParser()
chunker = SemanticChunker()
embedding_svc = EmbeddingService()


async def _delete_existing_chunks(document_id: str):
    """
    Deletes all Chunk records for a document before reprocessing.

    This is the idempotency guard for the document pipeline. If the worker
    crashed partway through a previous run, RabbitMQ will redeliver the
    message and the pipeline will restart from scratch. Without this step,
    every retry appends MORE chunk rows to PostgreSQL, creating duplicates.

    The Qdrant upsert is already idempotent (same vector IDs overwrite).
    This function makes the PostgreSQL side equally safe.

    Non-fatal: if this call fails (e.g. Next.js is briefly unavailable),
    we log a warning and proceed anyway. Duplicate chunks are ugly but not
    catastrophic, whereas blocking the pipeline on a cleanup failure is worse.
    """
    try:
        frontend_url = settings.ALLOWED_ORIGIN.rstrip("/")
        url = f"{frontend_url}/api/documents/{document_id}/chunks"
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.delete(
                url,
                headers={"X-Internal-Secret": settings.INTERNAL_SERVICE_SECRET},
            )
            if response.status_code not in (200, 204, 404):
                logger.warning(
                    "Chunk cleanup returned unexpected status %s for document %s — proceeding anyway",
                    response.status_code,
                    document_id,
                )
            else:
                logger.info("Chunk cleanup complete for document %s", document_id)
    except Exception as e:
        logger.warning(
            "Chunk cleanup failed for document %s: %s — proceeding anyway",
            document_id,
            e,
        )

async def update_document_status(document_id: str, data: dict):
    try:
        frontend_url = settings.ALLOWED_ORIGIN.rstrip("/")
        url = f"{frontend_url}/api/documents/{document_id}"
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(url, json=data)
    except Exception as e:
        logger.error(f"Failed to update document status in Next.js: {e}")

async def process_document_pipeline(
    file_path: str, 
    document_id: str, 
    workspace_id: str, 
    uploaded_by: str, 
    knowledge_base_id: Optional[str], 
    metadata: dict, 
    openai_api_key: str = None, 
    gemini_api_key: str = None
):
    try:
        from services.chat_service import rag_chain  # Local import to avoid circular dep

        # ── IDEMPOTENCY GUARD ─────────────────────────────────────────────────────
        # If this is a retry (the worker crashed during a previous attempt),
        # clean up any partial state before starting fresh.
        # - Deletes old Chunk rows in PostgreSQL so we don't accumulate duplicates
        # - Resets document status so the UI doesn't show a stale progress %
        await update_document_status(document_id, {
            "status": "PROCESSING",
            "currentStep": "Preparing (cleaning up previous attempt if any)",
            "progress": 5,
            "errorMessage": None,   # clear stale error from a previous crash
        })
        await _delete_existing_chunks(document_id)
        # ── END IDEMPOTENCY GUARD ─────────────────────────────────────────────────

        await update_document_status(document_id, {"status": "PROCESSING", "currentStep": "Downloading from MinIO", "progress": 10})
        logger.info(f"Downloading {file_path} from MinIO...")
        
        s3 = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        object_key = file_path
        if object_key.startswith("minio://"):
            parts = object_key.replace("minio://", "").split("/", 1)
            if len(parts) == 2:
                object_key = parts[1]

        ext = os.path.splitext(object_key)[1].lower()
        if not ext:
            ext = ".pdf" 

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            s3.download_file(settings.S3_BUCKET, object_key, tmp_file.name)
            local_path = tmp_file.name
            
        logger.info(f"Downloaded to local path: {local_path}")
        
        # 1. Parse
        await update_document_status(document_id, {"currentStep": "Parsing Document", "progress": 30})
        elements = parser.parse_document(local_path)
        
        for el in elements:
            if "metadata" not in el:
                el["metadata"] = {}
            el["metadata"]["document_id"] = document_id
            el["metadata"]["workspace_id"] = workspace_id
            if knowledge_base_id:
                el["metadata"]["knowledge_base_id"] = knowledge_base_id
            el["metadata"]["uploaded_by"] = uploaded_by
            
        # 2. Chunk
        await update_document_status(document_id, {"currentStep": "Chunking text", "progress": 50})
        chunks = chunker.chunk_documents(elements)
        logger.info(f"Created {len(chunks)} chunks for {document_id}")
        
        if not chunks:
            logger.warning(f"No text chunks could be extracted from {file_path}. It might be an image-only PDF.")
            await update_document_status(document_id, {
                "status": "INDEXED", 
                "progress": 100,
                "currentStep": "Completed with warnings: No text found"
            })
            return
            
        # 3. Embed
        await update_document_status(document_id, {"currentStep": "Generating Embeddings (Batched)", "progress": 70})
        texts = [c["content"] for c in chunks]
        
        batch_size = 100
        embeddings = []
        provider, dim = None, None
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_emb, prov, d = embedding_svc.embed_documents(
                batch_texts, 
                openai_api_key=openai_api_key, 
                gemini_api_key=gemini_api_key
            )
            embeddings.extend(batch_emb)
            if not provider:
                provider = prov
                dim = d
        
        # 4. Upsert to Qdrant
        await update_document_status(document_id, {"currentStep": "Saving to Vector Store", "progress": 90})
        vs = await get_vector_store(provider=provider, dimension=dim)
        await vs.upsert_chunks(chunks, embeddings)
        logger.info(f"Upserted {len(chunks)} vectors to Qdrant for {document_id}")
        
        # 5. Generate Summary and Questions
        await update_document_status(document_id, {"currentStep": "Generating Summary", "progress": 95})
        try:
            sample_text = " ".join([c["content"] for c in chunks[:5]])
            summary_data = await rag_chain.generate_summary_and_questions(
                sample_text, 
                openai_api_key=openai_api_key, 
                gemini_api_key=gemini_api_key
            )
        except Exception as summary_err:
            logger.error(f"Failed to generate summary: {summary_err}")
            summary_data = {"summary": None, "suggestedQuestions": None}
        
        await update_document_status(document_id, {
            "status": "INDEXED", 
            "currentStep": "Complete", 
            "progress": 100,
            "chunkCount": len(chunks),
            "embeddingModel": f"provider: {provider}, dim: {dim}",
            "summary": summary_data.get("summary"),
            "suggestedQuestions": summary_data.get("suggestedQuestions")
        })
        
    except Exception as e:
        logger.error(f"Pipeline failed for {document_id}: {e}")
        await update_document_status(document_id, {
            "status": "ERROR", 
            "errorMessage": str(e)
        })
