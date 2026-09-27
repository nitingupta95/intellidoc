import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";

// Applies to BYOK users too: their LLM calls run on their own key, but system
// resources they use (query embeddings, web search) are debited from the wallet.
export async function creditGuard(userId: string) {
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
