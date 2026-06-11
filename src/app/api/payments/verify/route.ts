import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifyPaymentSignature, calculatePeriodEnd } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 }
      );
    }

    // Find the pending payment
    const payment = await db.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (payment.status === "SUCCESS") {
      return NextResponse.json({ error: "Payment already verified" }, { status: 400 });
    }

    // ── CRITICAL: Server-side signature verification ───────
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      // Mark payment as failed
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      return NextResponse.json(
        { error: "Invalid payment signature. Payment verification failed." },
        { status: 400 }
      );
    }

    // ── Atomic transaction: update payment + subscription + user ──
    const periodEnd = calculatePeriodEnd();

    await db.$transaction([
      // 1. Mark payment as SUCCESS
      db.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: "SUCCESS",
        },
      }),

      // 2. Create or update subscription
      db.subscription.create({
        data: {
          userId: session.user.id,
          plan: payment.plan,
          status: "ACTIVE",
          startDate: new Date(),
          endDate: periodEnd,
        },
      }),

      // 3. Upgrade the user's plan
      db.user.update({
        where: { id: session.user.id },
        data: {
          plan: payment.plan,
          subscriptionStatus: "ACTIVE",
          currentPeriodEnd: periodEnd,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      plan: payment.plan,
      message: "Payment verified successfully. Your plan has been upgraded!",
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
