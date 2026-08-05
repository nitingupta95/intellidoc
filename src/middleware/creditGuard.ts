import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";

export async function creditGuard(userId: string, isBYOK: boolean) {
  // BYOK requests are never metered and never blocked by wallet balance
  if (isBYOK) {
    return null;
  }

  let wallet = await db.creditWallet.findUnique({
    where: { userId },
    select: { balance: true }
  });

  if (!wallet) {
    // Automatically provision a wallet for legacy users who don't have one
    wallet = await db.creditWallet.create({
      data: {
        userId,
        balance: 200,
        lifetimeGranted: 200,
        transactions: {
          create: {
            type: 'SIGNUP_GRANT',
            amount: 200,
            balanceAfter: 200
          }
        }
      },
      select: { balance: true }
    });
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
