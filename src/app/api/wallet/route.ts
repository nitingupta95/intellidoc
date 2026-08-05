import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const isBYOK = !!(user?.openaiKey || user?.geminiKey);

    if (isBYOK) {
      return NextResponse.json({ isBYOK: true });
    }

    const wallet = await db.creditWallet.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json({ 
      isBYOK: false, 
      balance: wallet?.balance ?? 0,
      lifetimeGranted: wallet?.lifetimeGranted ?? 0,
      lifetimeSpent: wallet?.lifetimeSpent ?? 0
    });
  } catch (error) {
    console.error('Failed to fetch wallet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
