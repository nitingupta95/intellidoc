import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { API_BASE_URL } from '@/lib/api';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check conversation ownership
    const conversation = await db.conversation.findUnique({
      where: { id: params.id, userId: session.user.id }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = await db.message.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership and get conversation metadata
    const conversation = await db.conversation.findUnique({
      where: { id: params.id, userId: session.user.id }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Save User message
    const userMessage = await db.message.create({
      data: {
        conversationId: params.id,
        role: 'user',
        content: message,
      }
    });

    // Auto-generate title if this is the first message
    if (conversation.title === 'New Chat') {
      try {
        const titleSnippet = message.substring(0, 30);
        await db.conversation.update({
          where: { id: params.id },
          data: { title: titleSnippet + (message.length > 30 ? '...' : '') }
        });
      } catch (err) {
        console.error('Failed to update title:', err);
      }
    }

    // Get last 10 messages for context
    const history = await db.message.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Reverse so chronological for the LLM
    const formattedHistory = history.reverse().map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Metadata from conversation (e.g. documentIds, knowledgeBaseId)
    const metadata = conversation.metadata as Record<string, any> || {};

    // Proxy stream to FastAPI
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        history: formattedHistory,
        document_ids: metadata.documentIds || null,
        knowledge_base_id: metadata.knowledgeBaseId || null,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to contact AI backend' }, { status: 502 });
    }

    // Transform stream: Intercept and save the assistant's message at the end
    const stream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullAssistantContent = "";
        let citationsData: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          controller.enqueue(value);

          // Parse SSE to accumulate text and citations
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).replace(/\r$/, '');
              if (dataStr === '[DONE]') {
                continue;
              }
              try {
                const json = JSON.parse(dataStr);
                if (json.event === 'citations') {
                  citationsData = json.data;
                }
              } catch {
                if (dataStr && !dataStr.startsWith('{')) {
                  // Basic text stream chunk
                  fullAssistantContent += dataStr;
                }
              }
            }
          }
        }

        // Stream finished, save to DB
        try {
          await db.message.create({
            data: {
              conversationId: params.id,
              role: 'assistant',
              content: fullAssistantContent.trim(),
              citations: citationsData ? JSON.stringify(citationsData) : null
            }
          });
        } catch (dbErr) {
          console.error("Failed to save assistant message", dbErr);
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
