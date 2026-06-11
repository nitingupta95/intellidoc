import { env } from '../env';

// Base API URL config
export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const uploadDocument = async (file: File, metadata: Record<string, any> = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));

  // Hit the Next.js API route which handles S3, DB, and FastAPI proxying
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload document');
  }

  return response.json();
}
