import asyncio
import json
import logging
from aio_pika import connect, IncomingMessage
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
            
            # Here we would normally download the file from MinIO,
            # but for Phase 2 we will just trigger the FastAPI internal pipeline.
            # We assume MinIO is accessible internally.
            
            # To actually process it in FastAPI, we'll POST to the local endpoint
            # or directly import the pipeline function.
            # Using HTTP POST to localhost:8000 is easiest to keep the event loop clean.
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://localhost:8000/api/v1/documents/process",
                    json={
                        "document_id": document_id,
                        "file_path": minio_path,
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
        connection = await connect(settings.RABBITMQ_URL)
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
