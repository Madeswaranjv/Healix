import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Globe, ExternalLink } from 'lucide-react';
import TiltCard from '../shared/TiltCard';

const MAX_WEB_SOURCES = 5;

/**
 * Source chips — small numbered pill chips.
 * Click opens a 3D tilt citation card, closes on outside click.
 * Web sources capped at MAX_WEB_SOURCES; document sources always shown.
 */
export default function SourceChips({ sources }) {
  const [expandedId, setExpandedId] = useState(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const chipRefs = useRef({});

  // Close card when clicking outside
  useEffect(() => {
    if (expandedId === null) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setExpandedId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedId]);

  // Close card on scroll
  useEffect(() => {
    if (expandedId === null) return;
    const handleScroll = () => setExpandedId(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [expandedId]);

  const handleChipClick = useCallback((chipId) => {
    if (expandedId === chipId) {
      setExpandedId(null);
      return;
    }
    // Calculate position from the chip element
    const chipEl = chipRefs.current[chipId];
    if (chipEl) {
      const rect = chipEl.getBoundingClientRect();
      setCardPos({
        top: rect.top - 8,  // above the chip with small gap
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
      });
    }
    setExpandedId(chipId);
  }, [expandedId]);

  if (!sources || sources.length === 0) return null;

  // Separate document vs web sources; limit web to MAX_WEB_SOURCES
  const docSources = sources.filter(s => s.type === 'document');
  const webSources = sources.filter(s => s.type !== 'document');
  const displayedWebSources = webSources.slice(0, MAX_WEB_SOURCES);
  const hiddenCount = webSources.length - displayedWebSources.length;
  const displayedSources = [...docSources, ...displayedWebSources];

  const getDomain = (url) => {
    try {
      if (!url || url === '#') return null;
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };

  // Find the source for the expanded card
  const expandedSource = expandedId !== null
    ? displayedSources.find((s, idx) => (s.id || idx) === expandedId)
    : null;
  const expandedIsWeb = expandedSource ? (expandedSource.type === 'web' || !!expandedSource.url) : false;
  const expandedDomain = expandedIsWeb ? getDomain(expandedSource?.url) : null;

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-[11px] text-muted font-medium mr-1">Sources:</span>
      {displayedSources.map((source, idx) => {
        const isWeb = source.type === 'web' || !!source.url;
        const displayLabel = source.type === 'document' ? `Doc ${idx + 1}` : `[${idx + 1}]`;
        const chipId = source.id || idx;
        const domain = isWeb ? getDomain(source.url) : null;

        return (
          <button
            key={chipId}
            ref={(el) => { chipRefs.current[chipId] = el; }}
            onClick={() => handleChipClick(chipId)}
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
        );
      })}

      {/* +N more indicator */}
      {hiddenCount > 0 && (
        <span className="text-[11px] text-muted font-medium px-1.5 py-0.5">
          +{hiddenCount} more
        </span>
      )}

      {/* Citation Card — rendered as a fixed-position portal to avoid nesting/overlap */}
      {expandedSource && (
        <div
          className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${cardPos.top}px`,
            left: `${cardPos.left}px`,
            transform: 'translateY(-100%)',
            minWidth: '280px',
            maxWidth: '340px',
          }}
        >
          <TiltCard
            className="
              bg-surface border border-border/80 rounded-2xl
              shadow-2xl text-left
            "
            style={{
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)',
            }}
          >
            <div className="p-4" style={{ position: 'relative', zIndex: 20 }}>
              {/* Header: title + domain badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  {expandedIsWeb
                    ? <Globe size={13} className="text-primary flex-shrink-0 mt-0.5" />
                    : <FileText size={13} className="text-secondary flex-shrink-0 mt-0.5" />
                  }
                  <p className="text-xs font-semibold text-ink leading-snug line-clamp-2">
                    {expandedSource.title}
                  </p>
                </div>
                {expandedDomain && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium flex-shrink-0 whitespace-nowrap">
                    {expandedDomain}
                  </span>
                )}
              </div>

              {/* Scrollable snippet section */}
              {expandedSource.snippet && (
                <div
                  className="
                    mb-3 rounded-xl border border-border/50 bg-canvas/70
                    overflow-y-auto
                  "
                  style={{ maxHeight: '110px' }}
                >
                  <p className="text-[11px] text-muted leading-relaxed p-2.5">
                    "{expandedSource.snippet}"
                  </p>
                </div>
              )}

              {/* Link */}
              {expandedSource.url && expandedSource.url !== '#' && (
                <a
                  href={expandedSource.url}
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
          </TiltCard>
        </div>
      )}
    </div>
  );
}

