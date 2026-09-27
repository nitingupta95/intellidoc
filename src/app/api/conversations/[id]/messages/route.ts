import { NextResponse, after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { API_BASE_URL } from '@/lib/api';
import { creditGuard } from '@/middleware/creditGuard';
import { truncateWords } from '@/lib/utils';
import { resolveAiKeys } from '@/lib/ai-keys';

export const maxDuration = 60; // Allow enough time for background RAGAS evaluation

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

    const evalUrl = `${API_BASE_URL}/evaluate`;

    // Only send API key headers when we have an actual key — empty string
    // headers fool the FastAPI endpoint into thinking a key was provided.
    const evalHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userOpenAIKey) evalHeaders['X-OpenAI-API-Key'] = userOpenAIKey;
    if (userGeminiKey) evalHeaders['X-Gemini-API-Key'] = userGeminiKey;

    const resp = await fetch(evalUrl, {
      method: 'POST',
      headers: evalHeaders,
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
        await db.conversation.update({
          where: { id: params.id },
          data: {
            title: truncateWords(message, 40),
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
    const { openaiKey: userOpenAIKey, geminiKey: userGeminiKey, isBYOK } = resolveAiKeys(userRecord);

    // BYOK users are still billed for system resources (query embeddings, web search),
    // so everyone goes through the wallet guard.
    const creditBlock = await creditGuard(session.user.id);
    if (creditBlock) return creditBlock;

    // Fetch document IDs to restrict search and their summaries for web-search sanity check
    let documentIds: string[] = [];
    const documentSummaries: Record<string, string> = {};
    // Display names so multi-doc answers and citations name their source file
    const documentNames: Record<string, string> = {};
    // context_type is the authoritative chat-mode signal sent to the AI service.
    // single_doc  = user is chatting with exactly one document.
    // knowledge_base = user is chatting across a KB or their whole workspace.
    let contextType: 'single_doc' | 'knowledge_base';
    // Only fully indexed documents are searchable — UPLOADED/PROCESSING/ERROR ones
    // have missing or partial chunks and must never be cited. The pipeline writes
    // INDEXED; READY is the older vocabulary still used by the seed data.
    const READY = { in: ['INDEXED', 'READY'] };

    if (metadata.documentId) {
      contextType = 'single_doc';
      const doc = await db.document.findFirst({
        where: { id: metadata.documentId, status: READY },
        select: { id: true, summary: true, title: true, filename: true }
      });
      if (doc) {
        documentIds = [doc.id];
        if (doc.summary) documentSummaries[doc.id] = doc.summary;
        documentNames[doc.id] = doc.title || doc.filename;
      }
    } else if (conversation.knowledgeBaseId) {
      const docs = await db.document.findMany({
        where: { knowledgeBaseId: conversation.knowledgeBaseId, status: READY },
        select: { id: true, summary: true, title: true, filename: true }
      });
      documentIds = docs.map((d) => d.id);
      docs.forEach((d) => {
        if (d.summary) documentSummaries[d.id] = d.summary;
        documentNames[d.id] = d.title || d.filename;
      });
      contextType = 'knowledge_base';
    } else {
      const docs = await db.document.findMany({
        where: { workspaceId: conversation.workspaceId, status: READY },
        select: { id: true, summary: true, title: true, filename: true }
      });
      documentIds = docs.map((d) => d.id);
      docs.forEach((d) => {
        if (d.summary) documentSummaries[d.id] = d.summary;
        documentNames[d.id] = d.title || d.filename;
      });
      contextType = 'knowledge_base';
    }

    // Nothing searchable yet: answer directly instead of sending an empty scope to
    // the AI service (which would find nothing and offer a web search).
    if (documentIds.length === 0) {
      const notReady = "None of the documents in this chat are ready to search yet. They may still be processing, or processing may have failed. Check their status on the Documents page and try again once they show as indexed.";
      await db.message.create({
        data: { conversationId: params.id, role: 'assistant', content: notReady }
      });
      return new Response(`data: ${JSON.stringify(notReady)}\n\ndata: [DONE]\n\n`, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // Proxy stream to FastAPI
    const chatHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_SERVICE_SECRET || '',
      'X-Uses-System-Key': isBYOK ? 'false' : 'true',
      'X-User-Id': session.user.id,
    };
    if (userOpenAIKey) chatHeaders['X-OpenAI-API-Key'] = userOpenAIKey;
    if (userGeminiKey) chatHeaders['X-Gemini-API-Key'] = userGeminiKey;

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: chatHeaders,
      body: JSON.stringify({
        query: message,
        workspace_id: conversation.workspaceId,
        knowledge_base_id: conversation.knowledgeBaseId || null,
        document_ids: documentIds,
        history: formattedHistory,
        document_summaries: Object.keys(documentSummaries).length > 0 ? documentSummaries : null,
        document_names: documentNames,
        context_type: contextType,
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
                    if (Array.isArray(json.data)) {
                      for (const citation of json.data) {
                        const text = citation.full_text || citation.text_snippet || '';
                        if (text && contextChunksForEval.length < 15) {
                          contextChunksForEval.push(text);
                        }
                      }
                    }
                  } else if (!json.event) {
                    fullAssistantContent += dataStr;
                  }
                  // needs_confirmation / synthesis_mode / multi_hop_trace are
                  // control events — never persist them as answer text.
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
          // For system-key users (isBYOK=false), pass empty strings so the AI service
          // evaluator falls back to its own settings.OPENAI_API_KEY, not the gateway key.
          const evalOpenAIKey = isBYOK ? userOpenAIKey : '';
          const evalGeminiKey = isBYOK ? userGeminiKey : '';
          after(async () => {
            try {
              await runRAGASEvaluation(
                evalMessageId,
                message,
                evalAssistantContent,
                contextChunksForEval,
                evalOpenAIKey,
                evalGeminiKey,
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
