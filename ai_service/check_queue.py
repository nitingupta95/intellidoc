import asyncio
from aio_pika import connect
from core.config import settings

async def main():
    try:
        connection = await connect(settings.RABBITMQ_URL, timeout=10)
        channel = await connection.channel()
        queue = await channel.declare_queue("document_processing", durable=True)
        print(f"Messages in queue: {queue.declaration_result.message_count}")
        await connection.close()
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
