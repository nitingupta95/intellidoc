import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// GET the masked API keys
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openaiKey: true, geminiKey: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found in database. Please log out and log in again.' }, { status: 404 });
    }

    const openaiKey = user?.openaiKey;
    const geminiKey = user?.geminiKey;

    const maskedOpenAI = openaiKey 
      ? (openaiKey.length > 8 ? `sk-...${openaiKey.slice(-4)}` : 'sk-...****') 
      : null;
      
    const maskedGemini = geminiKey 
      ? (geminiKey.length > 8 ? `...${geminiKey.slice(-4)}` : '...****') 
      : null;

    return NextResponse.json({ 
      hasOpenAIKey: !!openaiKey, 
      maskedOpenAIKey: maskedOpenAI,
      hasGeminiKey: !!geminiKey,
      maskedGeminiKey: maskedGemini
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST to update or create API keys
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { openaiKey, geminiKey } = await req.json();

    const dataToUpdate: any = {};
    if (openaiKey !== undefined) {
      if (openaiKey && (typeof openaiKey !== 'string' || !openaiKey.startsWith('sk-'))) {
        return NextResponse.json({ error: 'Invalid OpenAI API key format' }, { status: 400 });
      }
      dataToUpdate.openaiKey = openaiKey || null;
    }

    if (geminiKey !== undefined) {
      if (geminiKey && typeof geminiKey !== 'string') {
        return NextResponse.json({ error: 'Invalid Gemini API key format' }, { status: 400 });
      }
      dataToUpdate.geminiKey = geminiKey || null;
    }

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: dataToUpdate
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found in database. Please log out and log in again.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE to revoke the API keys
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await req.json();

    const dataToUpdate: any = {};
    if (type === 'openai') {
      dataToUpdate.openaiKey = null;
    } else if (type === 'gemini') {
      dataToUpdate.geminiKey = null;
    } else {
      return NextResponse.json({ error: 'Invalid key type to revoke' }, { status: 400 });
    }

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: dataToUpdate
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found in database. Please log out and log in again.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
