import React, { useEffect } from 'react';
import { Mic, Square, Loader2, MicOff, AlertCircle } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const {
    state,
    errorType,
    countdown,
    startRecording,
    stopRecording,
    resetVoice,
  } = useVoiceRecorder(onTranscript);

  // Auto-reset error state after 3 seconds
  useEffect(() => {
    if (state === 'error' && errorType !== 'permission-denied') {
      const timer = setTimeout(() => {
        resetVoice();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, errorType, resetVoice]);

  const formatCountdown = (seconds: number | null) => {
    if (seconds === null) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    
    if (state === 'idle' || state === 'error') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  let icon = <Mic size={18} />;
  if (state === 'recording') {
    icon = <Square size={16} fill="currentColor" />;
  } else if (state === 'processing') {
    icon = <Loader2 size={18} className="animate-spin" />;
  } else if (errorType === 'permission-denied') {
    icon = <MicOff size={18} />;
  } else if (state === 'error') {
    icon = <AlertCircle size={18} />;
  }

  const isRecording = state === 'recording';
  const buttonClass = `group relative flex items-center justify-center w-10 h-10 rounded-full border-none bg-transparent transition-all duration-200 ease-in-out shrink-0 outline-none
    ${isRecording 
      ? 'text-red-500' 
      : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed'
    }`;

  return (
    <div className="relative flex items-center justify-center mr-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'processing' || errorType === 'permission-denied'}
        className={buttonClass}
        aria-label="Voice Input"
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75 duration-1000"></span>
        )}
        <span className="relative z-10">{icon}</span>
        
        {errorType === 'permission-denied' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs font-medium pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Microphone access denied
          </div>
        )}
        
        {errorType === 'too-short' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs font-medium pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Recording too short
          </div>
        )}

        {errorType === 'empty-audio' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs font-medium pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Couldn't hear anything
          </div>
        )}
      </button>

      {isRecording && countdown !== null && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background text-foreground border border-border rounded-full px-2 py-0.5 text-xs font-medium pointer-events-none shadow-md whitespace-nowrap z-20">
          {formatCountdown(countdown)}
        </div>
      )}
    </div>
  );
}
