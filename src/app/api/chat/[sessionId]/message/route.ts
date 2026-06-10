import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';
import { retrieveChunks } from '@/lib/vectorStore';
import { buildRagChain } from '@/lib/langchain';
import { scoreHallucination } from '@/lib/hallucination';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const { message: userText } = body;

    if (!userText || typeof userText !== 'string') {
      return NextResponse.json({ error: 'EMPTY_MESSAGE' }, { status: 422 });
    }

    const chatSession = await db.chatSession.findUnique({
      where: { id: sessionId },
      include: { documents: { select: { id: true } } }
    });

    if (!chatSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (chatSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const docIds = chatSession.documents.map(d => d.id);

    // Save User Message synchronously
    await db.message.create({
      data: {
        sessionId,
        role: 'user',
        content: userText
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        let fullText = '';
        let hasWarning = false;
        let hallucinationScore = 0;
        let tokenCount = 0;

        try {
          // 1. Emit Start
          sendEvent('start', { sessionId, model: 'gpt-4o-mini' });

          // 2. Retrieve context
          const rawChunks = await retrieveChunks(userText, docIds);
          
          // Deduplicate chunks by chunkId
          const uniqueChunksMap = new Map();
          for (const chunk of rawChunks) {
            if (!uniqueChunksMap.has(chunk.id)) {
              uniqueChunksMap.set(chunk.id, chunk);
            }
          }
          const uniqueChunks = Array.from(uniqueChunksMap.values());

          // 3. Stream from Langchain
          const chain = buildRagChain();
          const responseStream = await chain.stream({ input: userText, context: uniqueChunks });

          for await (const chunk of responseStream) {
            const textDelta = chunk.text || '';
            fullText += textDelta;
            tokenCount += 1; // Simplistic proxy for tests
            sendEvent('delta', { text: textDelta });
          }

          // 4. Hallucination Check
          try {
            const sourceTexts = uniqueChunks.map(c => c.text);
            hallucinationScore = await scoreHallucination(fullText, sourceTexts);
            if (hallucinationScore >= 0.3) {
              hasWarning = true;
              sendEvent('warning', { score: hallucinationScore, threshold: 0.3 });
            }
          } catch (e) {
            console.warn('Hallucination scorer failed', e);
          }

          // 5. Save Assistant Message + Citations
          const assistantMsg = await db.message.create({
            data: {
              sessionId,
              role: 'assistant',
              content: fullText,
              hallucinationScore,
              hasWarning,
              citations: {
                create: uniqueChunks.map(c => ({
                  docId: c.docId,
                  chunkId: c.id,
                  pageNumber: c.pageNumber || 1,
                  excerpt: (c.text || '').substring(0, 200)
                }))
              }
            },
            include: { citations: true }
          });

          // 6. Emit Done
          sendEvent('done', { 
            tokenCount, 
            citations: assistantMsg.citations 
          });

        } catch (error: any) {
          console.error('Streaming error:', error);
          sendEvent('error', { message: error.message || 'Stream failed' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Chat message error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
