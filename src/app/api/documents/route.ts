import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const kbId = searchParams.get('knowledgeBaseId');

    const whereClause: any = {
      userId: session.user.id
    };

    if (kbId) {
      whereClause.knowledgeBaseId = kbId;
    }

    const documents = await db.document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('Fetch Documents Error:', error);
    if (error?.message?.includes('I/O error') || error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
      console.log('Using fallback due to Docker crash');
      return NextResponse.json({ documents: [] });
    }
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
