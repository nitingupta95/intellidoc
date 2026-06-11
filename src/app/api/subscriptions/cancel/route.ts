import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!user || user.plan === "FREE") {
      return NextResponse.json(
        { error: "No active paid subscription to cancel." },
        { status: 400 }
      );
    }

    if (user.subscriptionStatus === "CANCELLED") {
      return NextResponse.json(
        { error: "Subscription is already cancelled." },
        { status: 400 }
      );
    }

    // Cancel: mark subscription as cancelled, downgrade to FREE
    await db.$transaction([
      // Update the latest active subscription
      db.subscription.updateMany({
        where: {
          userId: session.user.id,
          status: "ACTIVE",
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      }),

      // Downgrade user plan
      db.user.update({
        where: { id: session.user.id },
        data: {
          plan: "FREE",
          subscriptionStatus: "CANCELLED",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled. You have been downgraded to the Free plan.",
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
