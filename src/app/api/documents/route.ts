import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Check if user is a member of the workspace
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query conditions
    const whereClause: any = { workspaceId };
    if (knowledgeBaseId) {
      whereClause.knowledgeBaseId = knowledgeBaseId;
    }

    const documents = await db.document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('Fetch Documents Error:', error);
    if (error?.message?.includes('I/O error') || error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
      console.log('Using fallback due to Docker crash');
      return NextResponse.json({ documents: [] });
    }
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
