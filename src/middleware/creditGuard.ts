import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";

export async function creditGuard(userId: string, isBYOK: boolean) {
  // BYOK requests are never metered and never blocked by wallet balance
  if (isBYOK) {
    return null;
  }

  const wallet = await db.creditWallet.findUnique({
    where: { userId },
    select: { balance: true }
  });

  if (!wallet) {
    return NextResponse.json(
      { error: "insufficient_credits", balance: 0, required: 1 },
      { status: 402 }
    );
  }

  // Quick short-circuit block if hard limit is breached
  if (wallet.balance <= -env.NEGATIVE_GRACE_CREDITS) {
    return NextResponse.json(
      { error: "insufficient_credits", balance: wallet.balance, required: 1 },
      { status: 402 }
    );
  }

  return null;
}
