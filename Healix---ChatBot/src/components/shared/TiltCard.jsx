import { useState, useRef, useCallback } from 'react';

/**
 * TiltCard — 3D perspective tilt effect with spotlight.
 * Pure vanilla JS/CSS approach (no external deps).
 */
export default function TiltCard({ children, className = '', style = {} }) {
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
      className={`will-change-transform relative ${className}`}
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
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
        style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.25s' }}
      >
        <div
          className="absolute w-[200%] h-[200%] rounded-full"
          style={{
            left: `${spotlightPos.x}%`,
            top: `${spotlightPos.y}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle closest-side, rgba(255,255,255,0.06) 0%, transparent 80%)',
          }}
        />
      </div>
    </div>
  );
}
