import amqp, { Connection, Channel } from 'amqplib';

let connection: any = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5682';
const QUEUE_NAME = 'document_processing';

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;

  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    connection = conn;
    channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });
    console.log('✅ Connected to RabbitMQ successfully');
    return channel;
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

export async function publishDocumentJob(documentId: string, minioPath: string, userId: string) {
  const ch = await getRabbitChannel();
  const msg = JSON.stringify({
    documentId,
    minioPath,
    userId,
    timestamp: new Date().toISOString()
  });

  ch.sendToQueue(QUEUE_NAME, Buffer.from(msg), {
    persistent: true
  });
  console.log(`📥 Published job for document ${documentId}`);
}
