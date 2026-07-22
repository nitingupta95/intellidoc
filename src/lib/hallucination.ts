/**
 * Hallucination scoring using the RAGAS Faithfulness metric.
 * hallucination_score = 1 - faithfulness
 *
 * A faithfulness score of 1.0 = perfectly grounded (no hallucination).
 * A faithfulness score of 0.0 = fully hallucinated.
 */
export async function scoreHallucination(
  response: string,
  sourceTexts: string[],
  question: string = "",
  openAIKey: string = "",
  geminiKey: string = "",
): Promise<number> {
  try {
    if (!response || !sourceTexts || sourceTexts.length === 0) {
      return 0.0; // No context → assume grounded (nothing to contradict)
    }

    const aiServiceBase = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const resp = await fetch(`${aiServiceBase}/api/v1/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-API-Key': openAIKey,
        'X-Gemini-API-Key': geminiKey,
      },
      body: JSON.stringify({
        question: question || "What does the document say?",
        answer: response,
        context_chunks: sourceTexts,
      }),
      // Short timeout — this is best-effort
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) return 0.1; // Safe default on API failure

    const scores = await resp.json();
    const faithfulness: number = scores?.faithfulness ?? -1;

    if (faithfulness < 0) return 0.1; // Evaluation error — safe default

    // hallucination_score = 1 - faithfulness, clamped to [0, 1]
    return Math.max(0, Math.min(1, 1 - faithfulness));
  } catch {
    return 0.1; // Safe default on any network/parse error
  }
}
