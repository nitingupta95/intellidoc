import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const knowledgeBaseId = resolvedParams.id;
    const body = await req.json();
    const { documentIds } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'documentIds array is required' }, { status: 400 });
    }

    // Verify user owns the KB / has access
    const kb = await db.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
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

    if (!kb || kb.workspace.members.length === 0) {
      return NextResponse.json({ error: 'Forbidden or Knowledge Base not found' }, { status: 403 });
    }

    // Verify user has access to all the documents being linked
    const docsToLink = await db.document.findMany({
      where: {
        id: { in: documentIds },
        workspaceId: kb.workspaceId
      }
    });

    if (docsToLink.length !== documentIds.length) {
      return NextResponse.json({ error: 'One or more documents not found or do not belong to this workspace' }, { status: 400 });
    }

    // Update documents to belong to the new Knowledge Base
    await db.document.updateMany({
      where: { id: { in: documentIds } },
      data: { knowledgeBaseId: knowledgeBaseId }
    });

    return NextResponse.json({ success: true, count: documentIds.length });
  } catch (error: any) {
    console.error('Link Documents Error:', error);
    return NextResponse.json({ error: 'Failed to link documents' }, { status: 500 });
  }
}
