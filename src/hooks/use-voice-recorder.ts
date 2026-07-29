import { useState, useRef, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error';
export type VoiceErrorType = 'permission-denied' | 'empty-audio' | 'too-short' | 'network-error' | null;

interface UseVoiceRecorderReturn {
  state: VoiceState;
  errorType: VoiceErrorType;
  countdown: number | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  retryTranscribe: () => void;
  resetVoice: () => void;
}

const MAX_DURATION_MS = 60000; // 60 seconds
const MIN_AUDIO_BYTES = 2000; // ~2 KB min threshold for valid audio

export function useVoiceRecorder(onTranscript: (text: string) => void): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [errorType, setErrorType] = useState<VoiceErrorType>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);

  const cleanupIntervals = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCountdown(null);
  }, []);

  const resetVoice = useCallback(() => {
    setState('idle');
    setErrorType(null);
    chunksRef.current = [];
    lastBlobRef.current = null;
    cleanupIntervals();
  }, [cleanupIntervals]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setState('processing');
    setErrorType(null);
    lastBlobRef.current = audioBlob;

    if (audioBlob.size < MIN_AUDIO_BYTES) {
      setState('error');
      setErrorType('too-short');
      return;
    }

    try {
      const formData = new FormData();
      // Provide a filename with a generic extension so backend can process it.
      formData.append('file', audioBlob, 'voice-recording.webm');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.transcript && data.transcript.trim().length > 0) {
        onTranscript(data.transcript);
        setState('idle');
      } else {
        setState('error');
        setErrorType('empty-audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setState('error');
      setErrorType('network-error');
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      cleanupIntervals();
    }
  }, [state, cleanupIntervals]);

  const startRecording = useCallback(async () => {
    try {
      setErrorType(null);
      
      // Request mic permission
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Check mime types
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = ''; // Let browser decide
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: mimeType || undefined });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setState('recording');
      
      // Countdown logic
      let secondsLeft = Math.floor(MAX_DURATION_MS / 1000);
      setCountdown(secondsLeft);
      
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        setCountdown(secondsLeft);
      }, 1000);

      // Auto stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_DURATION_MS);

    } catch (error) {
      console.error('Microphone error:', error);
      setState('error');
      setErrorType('permission-denied');
    }
  }, [transcribeAudio, stopRecording]);

  const retryTranscribe = useCallback(() => {
    if (lastBlobRef.current) {
      transcribeAudio(lastBlobRef.current);
    }
  }, [transcribeAudio]);

  return {
    state,
    errorType,
    countdown,
    startRecording,
    stopRecording,
    retryTranscribe,
    resetVoice,
  };
}
