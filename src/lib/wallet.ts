import { db } from "@/lib/db";
import { env } from "@/env";

export async function debitCredits(userId: string, amount: number, metadata: any = {}) {
  if (amount <= 0) return { success: true, balance: 0 };
  
  // Debit query using raw SQL for row-level lock and safety against race conditions
  const result = await db.$executeRaw`
    UPDATE "CreditWallet"
    SET balance = balance - ${amount}, "lifetimeSpent" = "lifetimeSpent" + ${amount}
    WHERE "userId" = ${userId} AND balance >= ${amount} - ${env.NEGATIVE_GRACE_CREDITS}
  `;

  if (result === 0) {
    // Insufficient funds (or wallet doesn't exist)
    return { success: false, error: "insufficient_funds" };
  }

  const wallet = await db.creditWallet.findUnique({
    where: { userId },
    select: { id: true, balance: true }
  });

  if (!wallet) return { success: false, error: "wallet_not_found" };

  // Record the transaction
  const tx = await db.creditTransaction.create({
    data: {
      walletId: wallet.id,
      amount: -amount,
      type: "DEBIT_CHAT",
      balanceAfter: wallet.balance,
      metadata: metadata || {}
    }
  });

  return { success: true, balance: wallet.balance, transactionId: tx.id };
}
