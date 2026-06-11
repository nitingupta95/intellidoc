import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';
import { env } from '../../../env';

const AI_SERVICE_URL = env.AI_SERVICE_URL;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams();
    params.set('userId', session.user.id);

    // Forward optional filters
    const docId = searchParams.get('docId');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');
    if (docId) params.set('docId', docId);
    if (type) params.set('type', type);
    if (limit) params.set('limit', limit);

    const res = await fetch(`${AI_SERVICE_URL}/api/v1/graph?${params.toString()}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Graph API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}
