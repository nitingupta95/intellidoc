import amqp, { Connection, ConfirmChannel } from 'amqplib';

let connection: any = null;
let channel: ConfirmChannel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5682';
const QUEUE_NAME = 'document_processing';

export async function getRabbitChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;

  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    connection = conn;
    // Use ConfirmChannel so we can await message delivery in serverless environments
    channel = await conn.createConfirmChannel();
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });
    console.log('✅ Connected to RabbitMQ successfully (Confirm Channel)');
    return channel;
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

export async function publishDocumentJob(documentId: string, minioPath: string, userId: string, workspaceId: string, knowledgeBaseId: string | null = null) {
  const ch = await getRabbitChannel();
  const msg = JSON.stringify({
    documentId,
    minioPath,
    userId,
    workspaceId,
    knowledgeBaseId,
    timestamp: new Date().toISOString()
  });

  // sendToQueue returns a boolean, but because this is a ConfirmChannel, it takes a callback or we can use waitForConfirms
  ch.sendToQueue(QUEUE_NAME, Buffer.from(msg), {
    persistent: true
  });
  
  // Await network flush/ack to guarantee delivery before Vercel serverless function freezes
  await ch.waitForConfirms();
  
  console.log(`📥 Published job for document ${documentId}`);
}
