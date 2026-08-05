import { NextResponse, after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { API_BASE_URL } from '@/lib/api';

export const maxDuration = 60; 

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pendingId, consent } = await req.json();
    if (!pendingId) {
      return NextResponse.json({ error: 'pendingId is required' }, { status: 400 });
    }

    const conversation = await db.conversation.findUnique({
      where: { id: params.id, userId: session.user.id }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const userRecord = await db.user.findUnique({ where: { id: session.user.id } });
    const userOpenAIKey = userRecord?.openaiKey || process.env.OPENAI_API_KEY || "";
    const userGeminiKey = userRecord?.geminiKey || process.env.GEMINI_API_KEY || "";

    // Proxy stream to FastAPI
    const response = await fetch(`${API_BASE_URL}/chat/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-API-Key': userOpenAIKey,
        'X-Gemini-API-Key': userGeminiKey,
        'X-User-Id': session.user.id,
        'X-User-Plan': userRecord?.plan || "FREE",
      },
      body: JSON.stringify({
        pending_id: pendingId,
        consent: consent
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Backend Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to contact AI backend', details: errorText, status: response.status },
        { status: response.status === 410 ? 410 : 502 }
      );
    }

    // Transform stream: intercept, accumulate, save message
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
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          controller.enqueue(value);

          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).replace(/\r$/, '');
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                if (json && typeof json === 'object') {
                  if (json.event === 'citations') {
                    citationsData = json.data;
                  } else if (json.event === 'needs_confirmation') {
                    continue;
                  } else {
                    fullAssistantContent += dataStr;
                  }
                } else if (typeof json === 'string') {
                  fullAssistantContent += json;
                } else {
                  fullAssistantContent += dataStr;
                }
              } catch {
                if (dataStr && !dataStr.startsWith('{')) {
                  fullAssistantContent += dataStr;
                }
              }
            }
          }
        }

        // Stream finished — update the last empty message or create new
        if (fullAssistantContent.trim()) {
          try {
            // Find the last assistant message in this conversation
            const lastMsg = await db.message.findFirst({
              where: { conversationId: params.id, role: 'assistant' },
              orderBy: { createdAt: 'desc' }
            });
            
            if (lastMsg && !lastMsg.content) {
              await db.message.update({
                where: { id: lastMsg.id },
                data: {
                  content: fullAssistantContent.trim(),
                  citations: citationsData ? JSON.stringify(citationsData) : undefined
                }
              });
            } else {
              await db.message.create({
                data: {
                  conversationId: params.id,
                  role: 'assistant',
                  content: fullAssistantContent.trim(),
                  citations: citationsData ? JSON.stringify(citationsData) : undefined
                }
              });
            }
          } catch (dbErr) {
            console.error("Failed to save assistant message after resolve", dbErr);
          }
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
    console.error('Resolve error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
