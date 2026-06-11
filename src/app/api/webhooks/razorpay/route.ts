import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, calculatePeriodEnd } from "@/lib/razorpay";
import type { Plan } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // ── Verify webhook authenticity ──────────────────────────
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || event.id || `${event.event}_${Date.now()}`;
    const eventType = event.event;

    // ── Idempotency check ────────────────────────────────────
    const existing = await db.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existing?.processed) {
      // Already processed, return 200 to prevent Razorpay retries
      return NextResponse.json({ status: "already_processed" });
    }

    // Store the event
    await db.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
        payload: event,
        processed: false,
      },
      update: {},
    });

    // ── Process by event type ────────────────────────────────
    const payload = event.payload;

    switch (eventType) {
      case "payment.authorized":
      case "payment.captured": {
        const payment = payload?.payment?.entity;
        if (!payment) break;

        const orderId = payment.order_id;
        if (!orderId) break;

        // Update our payment record
        await db.payment.updateMany({
          where: { razorpayOrderId: orderId },
          data: {
            razorpayPaymentId: payment.id,
            status: "SUCCESS",
          },
        });
        break;
      }

      case "payment.failed": {
        const payment = payload?.payment?.entity;
        if (!payment) break;

        const orderId = payment.order_id;
        if (!orderId) break;

        await db.payment.updateMany({
          where: { razorpayOrderId: orderId },
          data: {
            razorpayPaymentId: payment.id,
            status: "FAILED",
          },
        });
        break;
      }

      case "subscription.activated": {
        const sub = payload?.subscription?.entity;
        if (!sub) break;

        const notes = sub.notes || {};
        const userId = notes.userId;
        const plan = notes.plan as Plan | undefined;

        if (userId && plan) {
          await db.$transaction([
            db.subscription.create({
              data: {
                userId,
                plan,
                status: "ACTIVE",
                startDate: new Date(),
                endDate: calculatePeriodEnd(),
                razorpaySubscriptionId: sub.id,
              },
            }),
            db.user.update({
              where: { id: userId },
              data: {
                plan,
                subscriptionStatus: "ACTIVE",
                razorpaySubscriptionId: sub.id,
                currentPeriodEnd: calculatePeriodEnd(),
              },
            }),
          ]);
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        const sub = payload?.subscription?.entity;
        if (!sub) break;

        const notes = sub.notes || {};
        const userId = notes.userId;

        if (userId) {
          await db.$transaction([
            db.subscription.updateMany({
              where: { userId, status: "ACTIVE" },
              data: {
                status: eventType === "subscription.cancelled" ? "CANCELLED" : "EXPIRED",
                cancelledAt: new Date(),
              },
            }),
            db.user.update({
              where: { id: userId },
              data: {
                plan: "FREE",
                subscriptionStatus: eventType === "subscription.cancelled" ? "CANCELLED" : "EXPIRED",
              },
            }),
          ]);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    // Mark event as processed
    await db.webhookEvent.update({
      where: { eventId },
      data: { processed: true },
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Return 200 to prevent Razorpay from retrying on application errors
    // The event is stored for manual inspection
    return NextResponse.json({ status: "error_logged" }, { status: 200 });
  }
}
