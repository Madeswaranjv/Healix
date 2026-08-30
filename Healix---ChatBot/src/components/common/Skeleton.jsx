/**
 * Shimmer skeleton bars for loading states.
 * Not spinners — shimmer reads as "in progress" per §7.
 */
export function SkeletonLine({ width = '100%', height = '12px', className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ lines = 3, className = '' }) {
  const widths = ['100%', '85%', '70%', '92%', '60%'];
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonChatList({ count = 5 }) {
  return (
    <div className="space-y-2 p-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <SkeletonLine width="20px" height="20px" className="rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width={`${60 + Math.random() * 30}%`} height="10px" />
            <SkeletonLine width={`${40 + Math.random() * 20}%`} height="8px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonMessages({ count = 4 }) {
  return (
    <div className="space-y-6 p-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const isUser = i % 2 === 0;
        return (
          <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`${isUser ? 'max-w-[60%]' : 'max-w-[70%]'} space-y-2`}>
              <SkeletonLine width="100%" height="14px" />
              <SkeletonLine width="80%" height="14px" />
              {!isUser && <SkeletonLine width="50%" height="14px" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
