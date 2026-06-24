import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for MinIO
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
  }
});
const BUCKET = process.env.S3_BUCKET || 'doc-management-test-bucket';

export const uploadFile = async (buffer: Buffer, key: string, mimeType?: string): Promise<string> => {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    }));
  } catch (error: any) {
    if (error.name === 'NoSuchBucket') {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType
      }));
    } else {
      throw error;
    }
  }
  return key;
};

export const uploadFileToStorage = uploadFile;

export const deleteFile = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
};

export const downloadFile = async (key: string): Promise<Buffer> => {
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  }));
  const byteArray = await response.Body?.transformToByteArray();
  if (!byteArray) throw new Error('Failed to download file');
  return Buffer.from(byteArray);
};

export const getFileUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

export const getUploadPresignedUrl = async (key: string, mimeType: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType
  });
  // URL expires in 15 minutes
  return getSignedUrl(s3, command, { expiresIn: 900 });
};
