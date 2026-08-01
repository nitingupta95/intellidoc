import logging
import boto3
from fastapi import BackgroundTasks, HTTPException
from core.config import settings
from schemas.document import DocumentProcessRequest
from services.document_service import process_document_pipeline

logger = logging.getLogger(__name__)

async def handle_document_process(
    request: DocumentProcessRequest, 
    bg_tasks: BackgroundTasks, 
    x_openai_api_key: str, 
    x_gemini_api_key: str
):
    logger.info(f"Queuing document processing: {request.document_id}")
    MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MiB limit
    
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        object_key = request.file_path
        if object_key.startswith("minio://"):
            parts = object_key.replace("minio://", "").split("/", 1)
            if len(parts) == 2:
                object_key = parts[1]
                
        head = s3.head_object(Bucket=settings.S3_BUCKET, Key=object_key)
        size = head.get("ContentLength", 0)
        if size > MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds maximum allowed size of {MAX_SIZE_BYTES // (1024 * 1024)} MiB."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify PDF size: {e}")

    bg_tasks.add_task(
        process_document_pipeline,
        request.file_path,
        request.document_id,
        request.workspace_id,
        request.uploaded_by,
        request.knowledge_base_id,
        request.metadata,
        x_openai_api_key,
        x_gemini_api_key,
    )
    return {"status": "processing_queued", "document_id": request.document_id}
