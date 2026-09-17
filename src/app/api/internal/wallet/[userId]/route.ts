import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await props.params;
    const authHeader = req.headers.get("authorization");
    
    if (authHeader !== `Bearer ${env.INTERNAL_SERVICE_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Upsert ensures that users created via OAuth or before the wallet feature 
    // was introduced automatically get a wallet with a default balance.
    const wallet = await db.creditWallet.upsert({
      where: { userId: params.userId },
      update: {}, // Do nothing if it exists
      create: {
        userId: params.userId,
        balance: 1000,
        lifetimeGranted: 1000,
        transactions: {
          create: {
            type: 'SIGNUP_GRANT',
            amount: 1000,
            balanceAfter: 1000
          }
        }
      },
      select: { balance: true }
    });

    return NextResponse.json({ balance: wallet.balance });
  } catch (error) {
    console.error("Internal wallet fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
