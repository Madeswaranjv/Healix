import { useState, useEffect } from 'react';
import { Globe, Search, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Standard Clinical Loading Verbs
 */
const HEALTHCARE_GERUNDS = [
  "Analyzing clinical query...",
  "Synthesizing health evidence...",
  "Evaluating medical literature...",
  "Assessing safety profiles...",
  "Formulating structured response...",
  "Reasoning clinically...",
];

/**
 * Clean Web Search Phrases
 */
const WEB_SEARCH_PHRASES = [
  "Calling MCP Web Search...",
  "Retrieving clinical sources...",
  "Searching medical literature...",
  "Synthesizing live web evidence...",
];

export default function PulseIndicator({ isWebSearch = false, toolStatus = null }) {
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const activePhrases = isWebSearch ? WEB_SEARCH_PHRASES : HEALTHCARE_GERUNDS;

  useEffect(() => {
    setIndex(0);
  }, [isWebSearch]);

  useEffect(() => {
    if (toolStatus) return; // Freeze phrase cycling if explicit tool action is active

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % activePhrases.length);
        setIsFading(false);
      }, 200);
    }, 2000);

    return () => clearInterval(interval);
  }, [activePhrases.length, toolStatus]);

  // Determine active display text
  let displayText = activePhrases[index % activePhrases.length];
  let customIcon = null;

  if (toolStatus) {
    if (toolStatus.type === 'tool_call') {
      const query = toolStatus.arguments?.query || toolStatus.arguments?.topic || '';
      const displayQuery = query.length > 40 ? query.slice(0, 38) + '...' : query;
      displayText = query ? `MCP Search: "${displayQuery}"` : `Executing MCP ${toolStatus.name || 'tool'}...`;
      customIcon = <Loader2 size={13} className="text-primary animate-spin flex-shrink-0" />;
    } else if (toolStatus.type === 'tool_result') {
      displayText = `Retrieved ${toolStatus.count || 'sources'} medical references`;
      customIcon = <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />;
    }
  }

  return (
    <div className="flex gap-3 items-center py-2">
      {/* Animated Transforming Logo Avatar */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-visible">
          <img
            src="/logo_animation.webp"
            alt="Healix AI"
            className="w-full h-full object-contain select-none pointer-events-none rounded-full"
          />
        </div>
      </div>

      {/* Dynamic Text with Live MCP Search Status */}
      <div className="flex items-center gap-1.5 min-h-[24px] max-w-[500px]">
        {customIcon ? (
          customIcon
        ) : isWebSearch ? (
          <Globe size={13} className="text-primary flex-shrink-0 animate-pulse" />
        ) : null}
        <p
          className={`
            text-xs font-medium ${isWebSearch || toolStatus ? 'text-primary font-medium' : 'text-ink/75'} tracking-tight truncate
            transition-all duration-200 ease-in-out
            ${isFading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}
          `}
        >
          {displayText}
        </p>
      </div>
    </div>
  );
}
