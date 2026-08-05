export const CREDIT_RATES = {
  "gpt-4o":            { input: 5,  output: 15 }, // credits per 1K tokens
  "gemini-2.0-flash":  { input: 1,  output: 3  },
  "whisper-1":         { perMinute: 6 },
  "embedding-default": { input: 1 },
  "web-search":        { perRequest: 7 },
} as const;
