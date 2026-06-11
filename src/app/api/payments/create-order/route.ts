import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOrder, PLANS, PlanKey } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const plan = body.plan as PlanKey;

    if (!plan || !PLANS[plan] || PLANS[plan].price === 0) {
      return NextResponse.json(
        { error: "Invalid plan. Choose PRO or ENTERPRISE." },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription to this plan
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, subscriptionStatus: true },
    });

    if (user?.plan === plan && user?.subscriptionStatus === "ACTIVE") {
      return NextResponse.json(
        { error: "You are already subscribed to this plan." },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await createOrder(plan, session.user.id);

    // Save payment record
    await db.payment.create({
      data: {
        userId: session.user.id,
        razorpayOrderId: order.id,
        amount: PLANS[plan].price,
        currency: "INR",
        status: "PENDING",
        plan: plan,
        receipt: order.receipt as string,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: PLANS[plan].price,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      plan,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
