import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getRedisClient } from '@/lib/redis/client';
import crypto from 'crypto';
import OpenAI, { toFile } from 'openai';
import { db } from '@/lib/db';

const MAX_FILE_SIZE = Number(process.env.VOICE_MAX_AUDIO_BYTES) || 10485760; // 10MB
const ALLOWED_MIME_TYPES = (process.env.VOICE_ALLOWED_MIME_TYPES || 'audio/webm,audio/mp4,audio/ogg').split(',');
const RATE_LIMIT_RPM = Number(process.env.VOICE_RATE_LIMIT_RPM) || 20;

export async function POST(req: Request) {
  const t0 = performance.now();
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Audio file too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 413 });
    }

    // Checking MIME type, but browsers can append codecs, e.g. "audio/webm;codecs=opus"
    const fileMimeType = file.type.split(';')[0];
    if (!ALLOWED_MIME_TYPES.includes(fileMimeType)) {
      return NextResponse.json({ error: `Unsupported MIME type: ${file.type}` }, { status: 415 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Rate Limiting
    const redis = await getRedisClient();
    const minuteWindow = Math.floor(Date.now() / 60000);
    const rlKey = `voice_rl:${session.user.id}:${minuteWindow}`;
    
    const count = await redis.incr(rlKey);
    if (count === 1) {
      await redis.expire(rlKey, 60);
    }

    if (count > RATE_LIMIT_RPM) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Caching
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `voice_transcript:${hash}`;
    const cachedTranscript = await redis.get(cacheKey);

    if (cachedTranscript) {
      const latencyMs = Math.round(performance.now() - t0);
      console.log(JSON.stringify({
        event: 'voice_transcription',
        userId: session.user.id,
        audioBytes: buffer.length,
        whisperLatencyMs: 0,
        cacheHit: true,
        latencyMs,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        transcript: cachedTranscript,
        cached: true,
        latencyMs
      });
    }

    // Get user API keys if available, otherwise use env var
    const userRecord = await db.user.findUnique({ where: { id: session.user.id } });
    const userOpenAIKey = userRecord?.openaiKey || process.env.OPENAI_API_KEY;

    if (!userOpenAIKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: userOpenAIKey });

    const whisperStart = performance.now();
    
    // Call Whisper API
    // Must convert Buffer to a format OpenAI SDK accepts (File-like object)
    const fileForOpenAI = await toFile(buffer, file.name || 'audio.webm', { type: file.type });
    
    const response = await openai.audio.transcriptions.create({
      file: fileForOpenAI,
      model: process.env.WHISPER_MODEL || 'whisper-1',
      language: process.env.WHISPER_LANGUAGE !== 'auto' ? (process.env.WHISPER_LANGUAGE || 'en') : undefined,
    });

    const whisperLatencyMs = Math.round(performance.now() - whisperStart);
    
    const transcript = response.text;

    // Cache the result for 1 hour
    if (transcript && transcript.trim().length > 0) {
      await redis.setex(cacheKey, 3600, transcript);
    }

    const latencyMs = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({
      event: 'voice_transcription',
      userId: session.user.id,
      audioBytes: buffer.length,
      whisperLatencyMs,
      cacheHit: false,
      latencyMs,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      transcript,
      cached: false,
      latencyMs
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
  }
}
