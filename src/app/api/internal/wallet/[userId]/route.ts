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

    const wallet = await db.creditWallet.findUnique({
      where: { userId: params.userId },
      select: { balance: true }
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    return NextResponse.json({ balance: wallet.balance });
  } catch (error) {
    console.error("Internal wallet fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
