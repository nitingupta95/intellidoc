import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOrder, PLANS, PlanKey } from "@/lib/razorpay";
import { CREDIT_PACKS, CreditPackId } from "@/lib/creditPacks";
import Razorpay from "razorpay";

function getRazorpayInstance() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    if (body.purpose === "credits") {
      const packId = body.packId as CreditPackId;
      const pack = CREDIT_PACKS[packId];
      if (!pack) {
        return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
      }

      const rzp = getRazorpayInstance();
      const amountInPaise = pack.priceInr * 100;
      const order = await rzp.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_cred_${session.user.id.slice(-8)}_${Date.now().toString(36)}`,
        notes: {
          purpose: "credits",
          packId: pack.id,
          userId: session.user.id,
        },
      });

      const wallet = await db.creditWallet.upsert({
        where: { userId: session.user.id },
        update: {},
        create: {
          userId: session.user.id,
          balance: 0, // Fallback if no wallet existed yet
          lifetimeGranted: 0,
          lifetimeSpent: 0,
        }
      });
      
      await db.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PURCHASE",
          status: "PENDING",
          amount: pack.credits,
          razorpayOrderId: order.id,
          metadata: { packId: pack.id, priceInr: pack.priceInr },
        },
      });

      return NextResponse.json({
        orderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        purpose: "credits",
        packId,
      });
    }

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
