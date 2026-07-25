import asyncio
import json
import logging
from aio_pika import connect_robust, IncomingMessage
import httpx
from core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_message(message: IncomingMessage):
    async with message.process():
        body = message.body.decode()
        logger.info(f"Received message: {body}")
        
        try:
            data = json.loads(body)
            document_id = data.get("documentId")
            minio_path = data.get("minioPath")
            workspace_id = data.get("workspaceId")
            knowledge_base_id = data.get("knowledgeBaseId")
            user_id = data.get("userId")
            
            # Process it inline using the imported pipeline
            from main import process_document_pipeline
            await process_document_pipeline(
                file_path=minio_path,
                document_id=document_id,
                workspace_id=workspace_id,
                uploaded_by=user_id,
                knowledge_base_id=knowledge_base_id,
                metadata=data,
                openai_api_key=settings.OPENAI_API_KEY
            )
            logger.info(f"Successfully processed {document_id}")
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")

async def consume():
    try:
        connection = await connect_robust(settings.RABBITMQ_URL, timeout=10)
        channel = await connection.channel()
        
        queue = await channel.declare_queue("document_processing", durable=True)
        await channel.set_qos(prefetch_count=2)
        
        logger.info("RabbitMQ Consumer started. Waiting for messages...")
        await queue.consume(process_message)
        
        # Keep consumer running
        await asyncio.Future()
        
    except Exception as e:
        logger.error(f"Failed to connect or consume from RabbitMQ: {e}")

if __name__ == "__main__":
    asyncio.run(consume())
