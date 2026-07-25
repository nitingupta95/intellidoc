import { NextResponse, after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { API_BASE_URL } from '@/lib/api';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
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

// ─────────────────────────────────────────────────────────────────────────────
// Background RAGAS Evaluation
// Fires after the stream completes. Non-blocking — never throws to the user.
// ─────────────────────────────────────────────────────────────────────────────

async function runRAGASEvaluation(
  messageId: string,
  question: string,
  answer: string,
  contextChunks: string[],
  userOpenAIKey: string,
  userGeminiKey: string,
): Promise<void> {
  try {
    if (!contextChunks || contextChunks.length === 0) {
      console.log('[RAGAS] No context chunks available, skipping evaluation.');
      return;
    }

    const aiServiceBase = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const evalUrl = `${aiServiceBase}/api/v1/evaluate`;

    const resp = await fetch(evalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-API-Key': userOpenAIKey,
        'X-Gemini-API-Key': userGeminiKey,
      },
      body: JSON.stringify({
        question,
        answer,
        context_chunks: contextChunks,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[RAGAS] Evaluation API returned ${resp.status}: ${err}`);
      return;
    }

    const scores = await resp.json();
    console.log(`[RAGAS] Scores for message ${messageId}:`, scores);

    // Persist scores — null means "not evaluated", negative means "evaluation error"
    await db.message.update({
      where: { id: messageId },
      data: {
        faithfulness:     scores.faithfulness     >= 0 ? scores.faithfulness     : null,
        answerRelevancy:  scores.answer_relevancy  >= 0 ? scores.answer_relevancy  : null,
        contextPrecision: scores.context_precision >= 0 ? scores.context_precision : null,
        contextRecall:    scores.context_recall    >= 0 ? scores.context_recall    : null,
        // Map faithfulness → hallucinationScore (hallucination ≈ 1 - faithfulness)
        hallucinationScore: scores.faithfulness >= 0
          ? parseFloat((1 - scores.faithfulness).toFixed(4))
          : null,
      },
    });

    console.log(`[RAGAS] Scores saved to message ${messageId}.`);
  } catch (err) {
    // Never let evaluation errors surface to the user
    console.error('[RAGAS] Background evaluation failed silently:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Send a message and stream the response
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
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

    // Touch conversation to update its 'updatedAt' so it jumps to top
    try {
      if (conversation.title === 'New Chat') {
        const titleSnippet = message.substring(0, 30);
        await db.conversation.update({
          where: { id: params.id },
          data: {
            title: titleSnippet + (message.length > 30 ? '...' : ''),
            updatedAt: new Date()
          }
        });
      } else {
        await db.conversation.update({
          where: { id: params.id },
          data: { updatedAt: new Date() }
        });
      }
    } catch (err) {
      console.error('Failed to touch conversation:', err);
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

    const metadata = conversation.metadata as Record<string, any> || {};

    const userRecord = await db.user.findUnique({ where: { id: session.user.id } });
    const userOpenAIKey = userRecord?.openaiKey || process.env.OPENAI_API_KEY || "";
    const userGeminiKey = userRecord?.geminiKey || process.env.GEMINI_API_KEY || "";

    // Fetch document IDs to restrict search
    let documentIds: string[] = [];
    if (metadata.documentId) {
      documentIds = [metadata.documentId];
    } else if (conversation.knowledgeBaseId) {
      const docs = await db.document.findMany({
        where: { knowledgeBaseId: conversation.knowledgeBaseId },
        select: { id: true }
      });
      documentIds = docs.map(d => d.id);
    } else {
      const docs = await db.document.findMany({
        where: { workspaceId: conversation.workspaceId },
        select: { id: true }
      });
      documentIds = docs.map(d => d.id);
    }

    // Proxy stream to FastAPI
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-API-Key': userOpenAIKey,
        'X-Gemini-API-Key': userGeminiKey,
      },
      body: JSON.stringify({
        query: message,
        workspace_id: conversation.workspaceId,
        knowledge_base_id: conversation.knowledgeBaseId || null,
        document_ids: documentIds,
        history: formattedHistory,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Backend Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to contact AI backend', details: errorText, status: response.status },
        { status: 502 }
      );
    }

    // Transform stream: intercept, accumulate, save message + fire RAGAS evaluation
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
        // Collect full text of retrieved context chunks for RAGAS
        const contextChunksForEval: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          controller.enqueue(value);

          // Parse SSE lines to accumulate text and citations
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).replace(/\r$/, '');
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                if (json && typeof json === 'object' && json.event === 'citations') {
                  citationsData = json.data;
                  // Extract full_text from each citation for RAGAS evaluation
                  if (Array.isArray(json.data)) {
                    for (const citation of json.data) {
                      const text = citation.full_text || citation.text_snippet || '';
                      if (text) contextChunksForEval.push(text);
                    }
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

        // Stream finished — save assistant message to DB
        let savedMessageId: string | null = null;
        try {
          const savedMsg = await db.message.create({
            data: {
              conversationId: params.id,
              role: 'assistant',
              content: fullAssistantContent.trim(),
              citations: citationsData ? JSON.stringify(citationsData) : undefined
            }
          });
          savedMessageId = savedMsg.id;
        } catch (dbErr) {
          console.error("Failed to save assistant message", dbErr);
        }

        // Fire RAGAS evaluation in the background (non-blocking, keeps Vercel lambda alive)
        if (savedMessageId && fullAssistantContent.trim()) {
          const evalMessageId = savedMessageId;
          const evalAssistantContent = fullAssistantContent.trim();
          after(async () => {
            try {
              await runRAGASEvaluation(
                evalMessageId,
                message,
                evalAssistantContent,
                contextChunksForEval,
                userOpenAIKey,
                userGeminiKey,
              );
            } catch (err) {
              console.error('[RAGAS] Unhandled evaluation error:', err);
            }
          });
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
