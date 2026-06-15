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
            
            # To actually process it in FastAPI, we'll POST to the local endpoint
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.AI_SERVICE_URL}/api/v1/documents/process",
                    json={
                        "document_id": document_id,
                        "file_path": minio_path,
                        "workspace_id": workspace_id,
                        "knowledge_base_id": knowledge_base_id,
                        "uploaded_by": user_id,
                        "metadata": data
                    },
                    timeout=30.0
                )
                
            if response.status_code == 200:
                logger.info(f"Successfully queued internal processing for {document_id}")
            else:
                logger.error(f"Failed to trigger internal processing: {response.text}")
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")

async def consume():
    try:
        connection = await connect_robust(settings.RABBITMQ_URL, timeout=10)
        channel = await connection.channel()
        
        queue = await channel.declare_queue("document_processing", durable=True)
        
        logger.info("RabbitMQ Consumer started. Waiting for messages...")
        await queue.consume(process_message)
        
        # Keep consumer running
        await asyncio.Future()
        
    except Exception as e:
        logger.error(f"Failed to connect or consume from RabbitMQ: {e}")

if __name__ == "__main__":
    asyncio.run(consume())
