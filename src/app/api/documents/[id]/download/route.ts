import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';
import { downloadFile } from '@/lib/storage';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id }
            }
          }
        }
      }
    });

    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    if (document.workspace.members.length === 0) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Download the file from S3 / MinIO
    let fileBuffer;
    try {
      fileBuffer = await downloadFile(document.storageKey);
    } catch (e) {
      return new NextResponse('File not found on disk', { status: 404 });
    }

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${document.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Download Document Error:', error);
    return new NextResponse('Failed to download document', { status: 500 });
  }
}
