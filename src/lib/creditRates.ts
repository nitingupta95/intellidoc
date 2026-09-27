export const CREDIT_RATES = {
  "gpt-4o":            { input: 5,  output: 15 }, // credits per 1K tokens
  "gemini-2.0-flash":  { input: 1,  output: 3  },
  "gpt-4o-mini":       { input: 1,  output: 3  }, // document summaries on the system key
  "whisper-1":         { perMinute: 6 },
  "embedding-default": { input: 1 },
  "web-search":        { perRequest: 7 },
} as const;
