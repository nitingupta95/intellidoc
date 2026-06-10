import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const { messageId, rating } = body;

    if (!messageId || !rating) {
      return NextResponse.json({ error: 'Missing messageId or rating' }, { status: 422 });
    }

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

    const message = await db.message.findUnique({
      where: { id: messageId }
    });

    if (!message || message.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.role !== 'assistant') {
      return NextResponse.json({ error: 'INVALID_TARGET' }, { status: 422 });
    }

    await db.messageFeedback.upsert({
      where: { messageId },
      update: { rating },
      create: {
        messageId,
        rating
      }
    });

    return NextResponse.json({ message: 'Feedback recorded' }, { status: 200 });

  } catch (error) {
    console.error('Chat feedback error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
