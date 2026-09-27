import { safeDecryptApiKey } from '@/lib/crypto';

/**
 * Which API keys an AI request runs on.
 *
 * BYOK users (any stored key) run on their OWN keys only — the system keys are
 * never mixed in, so a Gemini-only user no longer gets answers on the system
 * OpenAI key. Everyone else runs on the system keys and is metered normally.
 * Stored keys are AES-encrypted, so they must be decrypted before use.
 */
export function resolveAiKeys(user: { openaiKey: string | null; geminiKey: string | null } | null) {
  const openaiKey = safeDecryptApiKey(user?.openaiKey) ?? '';
  const geminiKey = safeDecryptApiKey(user?.geminiKey) ?? '';
  const isBYOK = !!(openaiKey || geminiKey);

  return isBYOK
    ? { openaiKey, geminiKey, isBYOK }
    : {
        openaiKey: process.env.OPENAI_API_KEY || '',
        geminiKey: process.env.GEMINI_API_KEY || '',
        isBYOK,
      };
}
