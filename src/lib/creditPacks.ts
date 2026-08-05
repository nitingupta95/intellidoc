export const SIGNUP_GRANT = 20_000;

export const CREDIT_PACKS = {
  starter: { id: "starter", credits: 100_000, priceInr: 199 },
  growth: { id: "growth", credits: 500_000, priceInr: 799 },
  scale: { id: "scale", credits: 2_000_000, priceInr: 2499 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;
