import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

// GET /api/conversations
// List all conversations for the authenticated user
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await db.conversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        isPinned: true,
        isArchived: true,
        metadata: true,
        // Include last message snippet for sidebar
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
          }
        }
      }
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/conversations
// Create a new conversation
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { title = 'New Chat', metadata = {} } = body;

    const conversation = await db.conversation.create({
      data: {
        title,
        userId: session.user.id,
        metadata,
      }
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
