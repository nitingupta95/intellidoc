import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = 50;

    const chatSession = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true }
    });

    if (!chatSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (chatSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const queryArgs: any = {
      where: { sessionId },
      take: limit + 1,
      orderBy: { createdAt: 'asc' },
      include: {
        citations: true
      }
    };

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      queryArgs.skip = 1; // skip the cursor itself
    }

    const messages = await db.message.findMany(queryArgs);

    let nextCursor = null;
    if (messages.length > limit) {
      messages.pop();
      nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;
    }

    return NextResponse.json({
      data: messages,
      nextCursor
    });

  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
