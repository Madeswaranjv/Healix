import { useState } from 'react';
import { ArrowUpRight, FileText, Globe, ExternalLink } from 'lucide-react';

/**
 * Source chips — small numbered pill chips (accent-soft bg, mono numerals).
 * Click opens a citation panel showing the source title, domain snippet, and link.
 */
export default function SourceChips({ sources }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!sources || sources.length === 0) return null;

  const getDomain = (url) => {
    try {
      if (!url || url === '#') return null;
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-[11px] text-muted font-medium mr-1">Sources:</span>
      {sources.map((source, idx) => {
        const isWeb = source.type === 'web' || !!source.url;
        const displayLabel = source.type === 'document' ? `Doc ${idx + 1}` : `[${idx + 1}]`;
        const chipId = source.id || idx;
        const domain = isWeb ? getDomain(source.url) : null;

        return (
          <div key={chipId} className="relative">
            <button
              onClick={() => setExpandedId(expandedId === chipId ? null : chipId)}
              className="
                inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                text-[11px] font-mono bg-accent-soft text-ink hover:bg-primary/15 hover:text-primary
                border border-border/50 transition-colors duration-150
              "
              aria-label={`Source ${chipId}: ${source.title}`}
              aria-expanded={expandedId === chipId}
            >
              {isWeb ? <Globe size={10} className="text-primary" /> : <FileText size={10} className="text-secondary" />}
              <span>{displayLabel}</span>
              {domain && (
                <span className="text-[9px] text-muted font-sans opacity-75 hidden sm:inline">
                  • {domain}
                </span>
              )}
            </button>

            {/* Expanded citation panel */}
            {expandedId === chipId && (
              <div className="
                absolute bottom-full left-0 mb-2 z-30
                bg-surface border border-border rounded-xl
                shadow-xl p-3.5 min-w-[280px] max-w-[360px]
                text-left animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md
              ">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isWeb ? <Globe size={13} className="text-primary flex-shrink-0" /> : <FileText size={13} className="text-secondary flex-shrink-0" />}
                    <p className="text-xs font-semibold text-ink line-clamp-2">{source.title}</p>
                  </div>
                  {domain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex-shrink-0">
                      {domain}
                    </span>
                  )}
                </div>

                {source.snippet && (
                  <p className="text-[11px] text-muted leading-relaxed line-clamp-3 mb-2.5 bg-canvas/60 p-2 rounded-lg border border-border/50">
                    "{source.snippet}"
                  </p>
                )}

                {source.url && source.url !== '#' && (
                  <a
                    href={source.url}
                    className="
                      inline-flex items-center gap-1.5
                      text-xs font-medium text-primary
                      hover:text-primary-hover hover:underline
                      transition-colors duration-150
                    "
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>View original medical source</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
