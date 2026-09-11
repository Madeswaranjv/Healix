import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, VolumeX } from 'lucide-react';
import { synthesizeSpeech } from '../services/api';

// Global reference so only one message plays audio at a time
let currentActiveAudio: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

export interface SpeakerButtonProps {
  text: string;
  language?: string;
  className?: string;
}

/**
 * SpeakerButton — Plays assistant LLM responses as speech using Bhashini TTS.
 * States: idle → loading → playing (click to stop).
 */
export const SpeakerButton: React.FC<SpeakerButtonProps> = ({
  text,
  language = 'auto',
  className = '',
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop playback if component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (currentActiveAudio === audioRef.current) {
        currentActiveAudio = null;
        currentStopCallback = null;
      }
    };
  }, []);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus('idle');
    if (currentActiveAudio === audioRef.current) {
      currentActiveAudio = null;
      currentStopCallback = null;
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If currently playing, clicking stops audio
    if (status === 'playing') {
      stopPlayback();
      return;
    }

    if (status === 'loading') return;

    // Stop any other active speaker audio across the app
    if (currentActiveAudio && currentStopCallback) {
      currentStopCallback();
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await synthesizeSpeech({
        text,
        language: language || 'auto',
        gender: 'female',
      });

      if (!response || !response.audioContent) {
        throw new Error('No audio content returned from voice service.');
      }

      // Convert base64 audio to Blob URL for instant, native browser decoding
      const cleanBase64 = response.audioContent.replace(/^data:[^;]+;base64,/, '').trim();
      const binaryString = window.atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/wav' });
      const audioSrc = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      currentActiveAudio = audio;
      currentStopCallback = stopPlayback;

      audio.onended = () => {
        URL.revokeObjectURL(audioSrc);
        setStatus('idle');
        if (currentActiveAudio === audio) {
          currentActiveAudio = null;
          currentStopCallback = null;
        }
      };

      audio.onerror = (err) => {
        console.error('Audio playback error:', err);
        URL.revokeObjectURL(audioSrc);
        setStatus('error');
        setErrorMessage('Playback failed');
        setTimeout(() => setStatus('idle'), 3000);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setStatus('playing');
          })
          .catch((playErr) => {
            console.warn('Audio play() blocked or interrupted:', playErr);
            setStatus('idle');
          });
      }
    } catch (err: any) {
      console.error('TTS error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Speech failed');
      setTimeout(() => setStatus('idle'), 3500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        relative group/btn p-1.5 rounded-lg
        transition-all duration-150 cursor-pointer
        flex items-center justify-center
        ${status === 'playing'
          ? 'text-primary bg-primary/15 hover:bg-primary/25 ring-1 ring-primary/40'
          : status === 'loading'
          ? 'text-primary bg-primary/10 cursor-wait'
          : status === 'error'
          ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20'
          : 'text-muted hover:text-ink hover:bg-border/40'
        }
        ${className}
      `}
      aria-label={
        status === 'playing'
          ? 'Stop reading'
          : status === 'loading'
          ? 'Synthesizing voice...'
          : 'Read aloud'
      }
      title={status === 'error' ? errorMessage : undefined}
    >
      {status === 'loading' ? (
        <Loader2 size={13} className="animate-spin text-primary" />
      ) : status === 'playing' ? (
        <span className="relative flex items-center justify-center">
          <Square size={12} className="fill-current text-primary" />
          <span className="absolute -inset-1 rounded-full bg-primary/20 animate-ping pointer-events-none" />
        </span>
      ) : status === 'error' ? (
        <VolumeX size={13} className="text-rose-500" />
      ) : (
        <Volume2 size={13} className="transition-transform group-hover/btn:scale-110" />
      )}

      {/* Floating Tooltip matching Healix message bubble buttons */}
      <span
        className="
          absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
          px-2 py-0.5 rounded-md
          bg-ink text-canvas text-[10px] font-medium
          shadow-md pointer-events-none whitespace-nowrap
          opacity-0 translate-y-1 group-hover/btn:opacity-100 group-hover/btn:translate-y-0
          transition-all duration-150 z-30
        "
      >
        {status === 'playing'
          ? 'Stop reading'
          : status === 'loading'
          ? 'Generating speech...'
          : status === 'error'
          ? (errorMessage || 'Error')
          : 'Read aloud'}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
      </span>
    </button>
  );
};

export default SpeakerButton;
