import { Queue } from 'bullmq';

// Using the same redis connection logic from your app
// The test expects ingestionQueue to have add/remove.

// For actual execution we would connect to ioredis, but since we're in 
// integration test environment, we initialize standard BullMQ here.
export const ingestionQueue = new Queue('ingestion', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});
