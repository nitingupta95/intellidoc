import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') ?? 'json';

    const params = new URLSearchParams();
    params.set('userId', session.user.id);
    params.set('format', format);

    const res = await fetch(`${AI_SERVICE_URL}/api/v1/graph/export?${params.toString()}`);

    if (format === 'csv') {
      const csv = await res.text();
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="intellidoc-graph-${Date.now()}.csv"`,
        },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="intellidoc-graph-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Graph Export Error:', error);
    return NextResponse.json({ error: 'Failed to export graph' }, { status: 500 });
  }
}
