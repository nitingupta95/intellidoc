import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [payments, creditTxs] = await Promise.all([
      db.payment.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          amount: true,
          currency: true,
          status: true,
          plan: true,
          createdAt: true,
        },
      }),
      db.creditTransaction.findMany({
        where: { wallet: { userId: session.user.id }, type: "PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          amount: true,
          status: true,
          metadata: true,
          createdAt: true,
        },
      })
    ]);

    const formattedCreditTxs = creditTxs.map(tx => {
      // The amount in DB is the number of credits.
      // We need to parse metadata to get the actual INR price paid,
      // and multiply by 100 since the UI divides by 100 to show rupees.
      let priceInr = 0;
      if (tx.metadata && typeof tx.metadata === "object" && "priceInr" in tx.metadata) {
        priceInr = (tx.metadata as any).priceInr * 100;
      }
      
      let packId = "Credits";
      if (tx.metadata && typeof tx.metadata === "object" && "packId" in tx.metadata) {
        packId = `${(tx.metadata as any).packId} Pack`;
      }

      return {
        id: tx.id,
        razorpayOrderId: tx.razorpayOrderId || "-",
        razorpayPaymentId: tx.razorpayPaymentId || "-",
        amount: priceInr, // Send in paise format for UI
        currency: "INR",
        status: tx.status,
        plan: packId, // Treat credit pack as "plan"
        createdAt: tx.createdAt,
      };
    });

    const allRecords = [...payments, ...formattedCreditTxs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ payments: allRecords.slice(0, 50) });
  } catch (error) {
    console.error("Payment history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
