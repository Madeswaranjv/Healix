import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

/**
 * Standard Clinical Loading Verbs
 */
const HEALTHCARE_GERUNDS = [
  "Analyzing...",
  "Synthesizing...",
  "Evaluating...",
  "Assessing...",
  "Diagnosing...",
  "Consulting...",
  "Formulating...",
  "Reviewing...",
  "Reasoning...",
];

/**
 * Clean Web Search Phrases
 */
const WEB_SEARCH_PHRASES = [
  "Searching web...",
  "Retrieving clinical sources...",
  "Searching medical literature...",
  "Synthesizing web evidence...",
];

export default function PulseIndicator({ isWebSearch = false }) {
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const activePhrases = isWebSearch ? WEB_SEARCH_PHRASES : HEALTHCARE_GERUNDS;

  useEffect(() => {
    setIndex(0);
  }, [isWebSearch]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % activePhrases.length);
        setIsFading(false);
      }, 200);
    }, 2000);

    return () => clearInterval(interval);
  }, [activePhrases.length]);

  return (
    <div className="flex gap-3 items-center py-2">
      {/* Animated Transforming Logo Avatar — Expanded and rounded without square limits */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-visible">
          <img
            src="/logo_animation.webp"
            alt="Healix AI"
            className="w-full h-full object-contain select-none pointer-events-none rounded-full"
          />
        </div>
      </div>

      {/* Text with Web Icon when active */}
      <div className="flex items-center gap-1.5 min-h-[24px]">
        {isWebSearch && (
          <Globe size={13} className="text-primary flex-shrink-0" />
        )}
        <p
          className={`
            text-xs font-medium ${isWebSearch ? 'text-primary font-medium' : 'text-ink/75'} tracking-tight
            transition-all duration-200 ease-in-out
            ${isFading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}
          `}
        >
          {activePhrases[index % activePhrases.length]}
        </p>
      </div>
    </div>
  );
}
