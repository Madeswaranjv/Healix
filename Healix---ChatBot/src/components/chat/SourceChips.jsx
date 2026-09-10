import { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Globe, ExternalLink } from 'lucide-react';

/**
 * TiltCard — 3D perspective tilt effect with spotlight.
 * Pure vanilla JS/CSS approach (no external deps).
 */
function TiltCard({ children, className = '', style = {} }) {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
  );
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // evade effect: tilts away from cursor
    const xRot = (py - 0.5) * -18;
    const yRot = (px - 0.5) * 18;
    setTransform(
      `perspective(1000px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(1.03,1.03,1.03)`
    );
    setSpotlightPos({ x: px * 100, y: py * 100 });
  }, []);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);

  const handlePointerLeave = useCallback(() => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');
    setIsHovered(false);
  }, []);

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`will-change-transform relative overflow-hidden ${className}`}
      style={{
        transform,
        transition: 'transform 0.18s ease-out',
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {children}
      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
        style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.25s' }}
      >
        <div
          className="absolute w-[200%] h-[200%] rounded-full"
          style={{
            left: `${spotlightPos.x}%`,
            top: `${spotlightPos.y}%`,
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle, rgba(255,255,255,0.13) 0%, transparent 55%)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Source chips — small numbered pill chips.
 * Click opens a 3D tilt citation card with scrollable snippet, closes on outside click.
 */
export default function SourceChips({ sources }) {
  const [expandedId, setExpandedId] = useState(null);
  const containerRef = useRef(null);

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
    <div ref={containerRef} className="flex flex-wrap items-center gap-1.5 pt-1">
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

            {/* 3D Tilt Citation Card */}
            {expandedId === chipId && (
              <div
                className="
                  absolute bottom-full left-0 mb-2 z-50
                  animate-in fade-in zoom-in-95 duration-150
                "
                style={{ minWidth: '280px', maxWidth: '360px' }}
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
                        {isWeb
                          ? <Globe size={13} className="text-primary flex-shrink-0 mt-0.5" />
                          : <FileText size={13} className="text-secondary flex-shrink-0 mt-0.5" />
                        }
                        <p className="text-xs font-semibold text-ink leading-snug line-clamp-2">
                          {source.title}
                        </p>
                      </div>
                      {domain && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium flex-shrink-0 whitespace-nowrap">
                          {domain}
                        </span>
                      )}
                    </div>

                    {/* Scrollable snippet section */}
                    {source.snippet && (
                      <div
                        className="
                          mb-3 rounded-xl border border-border/50 bg-canvas/70
                          overflow-y-auto
                        "
                        style={{ maxHeight: '110px' }}
                      >
                        <p className="text-[11px] text-muted leading-relaxed p-2.5">
                          "{source.snippet}"
                        </p>
                      </div>
                    )}

                    {/* Link */}
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
                </TiltCard>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
