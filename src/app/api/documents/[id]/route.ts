import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const documentId = resolvedParams.id;
    const body = await req.json();
    const { status, chunkCount, embeddingModel, errorMessage, currentStep, progress } = body;
    
    // In a real app we'd verify an internal API key here, 
    // but since this is local we'll just allow it.

    const document = await db.document.update({
      where: { id: documentId },
      data: {
        ...(status && { status }),
        ...(chunkCount !== undefined && { chunkCount }),
        ...(embeddingModel && { embeddingModel }),
        ...(errorMessage !== undefined && { errorMessage }),
        ...(currentStep && { currentStep }),
        ...(progress !== undefined && { progress }),
      }
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error('Update Document Error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // Check if the document belongs to the user
    const document = await db.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.uploadedBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the document (cascade delete citations etc should be handled by Prisma schema)
    await db.document.delete({
      where: { id: documentId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Document Error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
