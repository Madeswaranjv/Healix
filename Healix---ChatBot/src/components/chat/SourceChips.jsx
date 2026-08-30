import { useState } from 'react';
import { ArrowUpRight, FileText, Globe } from 'lucide-react';

/**
 * Source chips — small numbered pill chips (accent-soft bg, mono numerals).
 * Click opens a citation panel showing the source title, snippet, and link.
 */
export default function SourceChips({ sources }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-[11px] text-muted font-medium mr-1">Sources:</span>
      {sources.map((source, idx) => {
        const isWeb = source.type === 'web' || !!source.url;
        const displayLabel = source.type === 'document' ? `Doc ${idx + 1}` : `[${idx + 1}]`;
        const chipId = source.id || idx;

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
            </button>

            {/* Expanded citation panel */}
            {expandedId === chipId && (
              <div className="
                absolute bottom-full left-0 mb-2 z-30
                bg-surface border border-border rounded-xl
                shadow-lg p-3 min-w-[260px] max-w-[340px]
                text-left animate-in fade-in zoom-in-95 duration-100
              ">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {isWeb ? <Globe size={13} className="text-primary flex-shrink-0" /> : <FileText size={13} className="text-secondary flex-shrink-0" />}
                  <p className="text-xs font-semibold text-ink line-clamp-1">{source.title}</p>
                </div>

                {source.snippet && (
                  <p className="text-[11px] text-muted leading-relaxed line-clamp-3 mb-2 bg-canvas/50 p-1.5 rounded-lg border border-border/40">
                    "{source.snippet}"
                  </p>
                )}

                {source.url && (
                  <a
                    href={source.url}
                    className="
                      inline-flex items-center gap-1
                      text-xs font-medium text-primary
                      hover:text-primary-hover
                      transition-colors duration-150
                    "
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Visit source link</span>
                    <ArrowUpRight size={12} />
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
