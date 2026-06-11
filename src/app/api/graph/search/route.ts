import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';
import { env } from '../../../../env';

const AI_SERVICE_URL = env.AI_SERVICE_URL;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ nodes: [] });
    }

    const params = new URLSearchParams();
    params.set('userId', session.user.id);
    params.set('q', q);
    const limit = searchParams.get('limit');
    if (limit) params.set('limit', limit);

    const res = await fetch(`${AI_SERVICE_URL}/api/v1/graph/search?${params.toString()}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Graph Search Error:', error);
    return NextResponse.json({ error: 'Failed to search graph' }, { status: 500 });
  }
}
