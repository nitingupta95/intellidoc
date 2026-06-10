import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { docIds } = body;

    if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
      return NextResponse.json({ error: 'NO_DOCS' }, { status: 422 });
    }

    // Verify all docs
    const docs = await db.document.findMany({
      where: {
        id: { in: docIds },
        userId: session.user.id
      }
    });

    if (docs.length !== docIds.length) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    for (const doc of docs) {
      if (doc.status !== 'READY') {
        return NextResponse.json({ error: 'DOCS_NOT_READY' }, { status: 422 });
      }
    }

    // Create chat session
    const chatSession = await db.chatSession.create({
      data: {
        userId: session.user.id,
        documents: {
          connect: docIds.map(id => ({ id }))
        }
      }
    });

    return NextResponse.json({ 
      sessionId: chatSession.id, docIds: docIds, model: 'gpt-4o-mini', 
      message: 'Session created' 
    }, { status: 201 });

  } catch (error) {
    console.error('Chat session create error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
