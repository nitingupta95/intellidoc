import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// GET the masked API key
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openaiKey: true }
    });

    if (user?.openaiKey) {
      // Mask the key: e.g., sk-proj-ABCD...XYZ -> sk-...XYZ
      const key = user.openaiKey;
      const masked = key.length > 8 ? `sk-...${key.slice(-4)}` : 'sk-...****';
      return NextResponse.json({ hasKey: true, maskedKey: masked });
    }

    return NextResponse.json({ hasKey: false, maskedKey: null });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST to update or create API key
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { openaiKey: apiKey }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE to revoke the API key
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { openaiKey: null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
