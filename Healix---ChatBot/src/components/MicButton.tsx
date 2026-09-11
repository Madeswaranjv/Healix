import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Globe, AlertCircle } from 'lucide-react';
import { transcribeAudio } from '../services/api';

export interface MicButtonProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  defaultLanguage?: string;
  className?: string;
}

const VOICE_LANGUAGES = [
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', short: 'TA' },
  { code: 'en', label: 'English', native: 'English', short: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', short: 'HI' },
];

/**
 * Encodes audio PCM buffer into standard 16-bit mono 16kHz WAV Blob.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  /* FMT sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true); // ByteRate (sampleRate * numChannels * bitsPerSample / 8)
  view.setUint16(32, 2, true); // BlockAlign (numChannels * bitsPerSample / 8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  /* DATA sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert Float32 [-1.0, 1.0] to 16-bit signed PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * MicButton — records voice from the user, sends it to Bhashini STT, and returns transcription.
 * States: idle → recording (pulsing red dot / timer) → transcribing (spinner) → idle.
 */
export const MicButton: React.FC<MicButtonProps> = ({
  onTranscript,
  disabled = false,
  defaultLanguage = 'ta',
  className = '',
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle');
  const [language, setLanguage] = useState<string>(defaultLanguage);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close language menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    if (showLangMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showLangMenu]);

  // Clean up recording if unmounted
  useEffect(() => {
    return () => {
      stopRecordingResources();
    };
  }, []);

  const stopRecordingResources = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled || status === 'transcribing') return;

    setErrorMessage('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      // Use buffer size of 4096 for smooth PCM capture
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Clone samples
        audioChunksRef.current.push(new Float32Array(inputData));
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);

      setStatus('recording');
      setRecordSeconds(0);

      // Start elapsed timer
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 60) {
            // Auto stop at 60s
            stopRecordingAndTranscribe();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setStatus('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Mic permission denied'
          : 'Microphone unavailable'
      );
      setTimeout(() => setStatus('idle'), 3500);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (status !== 'recording') return;

    setStatus('transcribing');
    const chunks = [...audioChunksRef.current];
    const targetLang = language;

    // Release mic stream immediately
    stopRecordingResources();

    if (chunks.length === 0) {
      setStatus('idle');
      return;
    }

    // Merge Float32Array chunks
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode to 16kHz WAV
    const wavBlob = encodeWav(mergedSamples, 16000);

    try {
      const response = await transcribeAudio({
        audioBlob: wavBlob,
        language: targetLang,
      });

      if (response && response.transcript) {
        onTranscript(response.transcript);
        setStatus('idle');
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Transcription failed');
      setTimeout(() => setStatus('idle'), 3500);
    }
  };

  const handleMicClick = () => {
    if (status === 'idle' || status === 'error') {
      startRecording();
    } else if (status === 'recording') {
      stopRecordingAndTranscribe();
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentLangObj = VOICE_LANGUAGES.find((l) => l.code === language) || VOICE_LANGUAGES[0];

  return (
    <div className="relative inline-flex items-center gap-1" ref={menuRef}>
      {/* Main Mic Button */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={disabled || status === 'transcribing'}
        className={`
          relative group/mic flex-shrink-0
          p-2 rounded-lg
          transition-all duration-200 cursor-pointer
          flex items-center justify-center gap-1.5
          ${status === 'recording'
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-500/40 px-2.5'
            : status === 'transcribing'
            ? 'bg-primary/15 text-primary cursor-wait px-2.5'
            : status === 'error'
            ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25'
            : disabled
            ? 'text-muted/50 cursor-not-allowed'
            : 'text-ink hover:text-ink hover:bg-sidebar-icon-hover active:text-ink'
          }
          ${className}
        `}
        aria-label={
          status === 'recording'
            ? 'Stop recording'
            : status === 'transcribing'
            ? 'Transcribing audio...'
            : `Voice input (${currentLangObj.label})`
        }
        title={status === 'error' ? errorMessage : undefined}
      >
        {status === 'recording' ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <Square size={13} className="fill-white" />
            <span className="text-[11px] font-mono font-medium tracking-tight">
              {formatSeconds(recordSeconds)}
            </span>
          </>
        ) : status === 'transcribing' ? (
          <>
            <Loader2 size={15} className="animate-spin text-primary" />
            <span className="text-[11px] font-medium text-primary">Transcribing...</span>
          </>
        ) : status === 'error' ? (
          <AlertCircle size={17} className="text-rose-500" />
        ) : (
          <Mic size={18} className="transition-transform group-hover/mic:scale-105" />
        )}

        {/* Tooltip when idle */}
        {status === 'idle' && (
          <span
            className="
              absolute bottom-full mb-2 left-1/2 -translate-x-1/2
              px-2 py-0.5 rounded-md
              bg-ink text-canvas text-[10px] font-medium
              shadow-md pointer-events-none whitespace-nowrap
              opacity-0 translate-y-1 group-hover/mic:opacity-100 group-hover/mic:translate-y-0
              transition-all duration-150 z-40
            "
          >
            Voice input ({currentLangObj.label})
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
          </span>
        )}
      </button>

      {/* Multilingual Selector Badge / Dropdown (Tamil, English, Hindi) */}
      {status !== 'recording' && status !== 'transcribing' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu((prev) => !prev)}
            disabled={disabled}
            className="
              text-[10px] font-semibold tracking-wider uppercase
              px-1.5 py-0.5 rounded-md
              text-muted hover:text-ink hover:bg-border/40
              transition-colors flex items-center gap-0.5 cursor-pointer
            "
            title="Change voice input language"
            aria-label="Change voice language"
          >
            <span>{currentLangObj.short}</span>
          </button>

          {showLangMenu && (
            <div
              className="
                absolute bottom-full right-0 mb-2 w-40
                flyout-menu py-1 z-50 shadow-lg rounded-xl
                animate-in fade-in zoom-in-95 duration-100
                border border-border/70 bg-surface
              "
            >
              <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted border-b border-border/50">
                Voice Language
              </div>
              {VOICE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={`
                    w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer
                    hover:bg-accent-soft transition-colors
                    ${language === lang.code ? 'text-primary font-semibold bg-primary/10' : 'text-ink'}
                  `}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{lang.label}</span>
                    <span className="text-[10px] text-muted">{lang.native}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted uppercase">{lang.short}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MicButton;
