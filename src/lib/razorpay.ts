import Razorpay from "razorpay";
import crypto from "crypto";
import { Plan } from "@prisma/client";

// ── Plan Configuration ─────────────────────────────────────

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,         // in paise
    priceDisplay: "₹0",
    period: "forever",
    features: [
      "5 document uploads",
      "50 AI queries/month",
      "500 MB storage",
      "Basic document analysis",
    ],
    limits: { uploads: 5, queries: 50, storageMB: 500 },
  },
  PRO: {
    name: "Pro",
    price: 49900,      // ₹499 in paise
    priceDisplay: "₹499",
    period: "month",
    features: [
      "100 document uploads",
      "2,000 AI queries/month",
      "10 GB storage",
      "Advanced AI analysis",
      "Priority processing",
      "Email support",
    ],
    limits: { uploads: 100, queries: 2000, storageMB: 10240 },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 199900,     // ₹1999 in paise
    priceDisplay: "₹1,999",
    period: "month",
    features: [
      "Unlimited uploads",
      "Unlimited AI queries",
      "100 GB storage",
      "Team collaboration",
      "Advanced analytics",
      "Dedicated support",
      "Custom integrations",
    ],
    limits: { uploads: -1, queries: -1, storageMB: 102400 },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── Razorpay SDK Instance ──────────────────────────────────

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// ── Create Order ───────────────────────────────────────────

export async function createOrder(plan: PlanKey, userId: string) {
  const planConfig = PLANS[plan];
  if (!planConfig || planConfig.price === 0) {
    throw new Error(`Cannot create order for plan: ${plan}`);
  }

  const razorpay = getRazorpayInstance();
  const order = await razorpay.orders.create({
    amount: planConfig.price,
    currency: "INR",
    receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString(36)}`,
    notes: {
      plan,
      userId,
    },
  });

  return order;
}

// ── Verify Payment Signature ───────────────────────────────

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET not configured");
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

// ── Verify Webhook Signature ───────────────────────────────

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// ── Fetch Payment Details ──────────────────────────────────

export async function fetchPayment(paymentId: string) {
  const razorpay = getRazorpayInstance();
  return razorpay.payments.fetch(paymentId);
}

// ── Refund Payment ─────────────────────────────────────────

export async function refundPayment(paymentId: string, amount?: number) {
  const razorpay = getRazorpayInstance();
  return razorpay.payments.refund(paymentId, {
    amount, // if undefined, full refund
  });
}

// ── Helper: Calculate period end (30 days from now) ────────

export function calculatePeriodEnd(): Date {
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return end;
}
