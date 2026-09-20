/**
 * Shimmer skeleton components for loading states.
 * Hardware-accelerated, high-fidelity skeletons matching Healix clinical UI.
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
  const widths = ['100%', '88%', '74%', '92%', '65%'];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} height="12px" />
      ))}
    </div>
  );
}

/**
 * Skeleton loader for the sidebar Chats list.
 * Precisely matches ChatListItem geometry: icon + title + timestamp.
 */
export function SkeletonChatList({ count = 6 }) {
  const titleWidths = ['75%', '60%', '85%', '70%', '55%', '80%'];

  return (
    <div className="space-y-1 px-2 py-1" aria-hidden="true" role="status" aria-label="Loading conversations">
      <span className="sr-only">Loading conversations...</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg"
        >
          {/* Message square icon placeholder */}
          <div className="skeleton w-4 h-4 rounded flex-shrink-0 opacity-70" />

          {/* Title line placeholder */}
          <div className="flex-1 min-w-0">
            <SkeletonLine
              width={titleWidths[i % titleWidths.length]}
              height="12px"
              className="rounded"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Main chat messages skeleton.
 * Mimics real Healix consultation layout with user queries, assistant response,
 * clinical card, source chips, and action toolbars.
 */
export function SkeletonChatArea() {
  return (
    <div
      className="w-full max-w-[760px] mx-auto py-6 px-3 sm:px-4 lg:px-0 space-y-7 animate-in fade-in duration-200"
      role="status"
      aria-label="Loading chat messages"
    >
      <span className="sr-only">Loading chat messages...</span>

      {/* ── Turn 1: User Query (Right-aligned) ── */}
      <div className="flex flex-col items-end">
        <div className="bg-accent-soft/70 border border-border/50 rounded-2xl rounded-br-md p-3.5 sm:px-4 sm:py-3.5 max-w-[85%] sm:max-w-[70%] w-[320px] shadow-xs space-y-2">
          <SkeletonLine width="100%" height="13px" className="rounded" />
          <SkeletonLine width="68%" height="13px" className="rounded" />
        </div>
        {/* Timestamp placeholder */}
        <div className="mt-1.5 mr-1">
          <SkeletonLine width="42px" height="9px" className="rounded opacity-60" />
        </div>
      </div>

      {/* ── Turn 1: Assistant Clinical Response (Left-aligned) ── */}
      <div className="flex items-start gap-3 w-full">
        {/* Healix AI Avatar placeholder */}
        <div className="skeleton w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0 space-y-3.5 pr-2 sm:pr-8">
          {/* Opening statement */}
          <div className="space-y-2">
            <SkeletonLine width="96%" height="13px" className="rounded" />
            <SkeletonLine width="90%" height="13px" className="rounded" />
            <SkeletonLine width="75%" height="13px" className="rounded" />
          </div>

          {/* Clinical Structured Card Box placeholder */}
          <div className="border border-border/70 bg-surface/70 rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="skeleton w-3.5 h-3.5 rounded-full opacity-80" />
              <SkeletonLine width="38%" height="12px" className="rounded font-semibold" />
            </div>
            <div className="space-y-2 pl-5">
              <SkeletonLine width="92%" height="11px" className="rounded" />
              <SkeletonLine width="84%" height="11px" className="rounded" />
              <SkeletonLine width="65%" height="11px" className="rounded" />
            </div>
          </div>

          {/* Follow-up synthesis paragraph */}
          <div className="space-y-2">
            <SkeletonLine width="94%" height="13px" className="rounded" />
            <SkeletonLine width="82%" height="13px" className="rounded" />
          </div>

          {/* Source Chips pill placeholders */}
          <div className="flex items-center gap-2 pt-1">
            <SkeletonLine width="105px" height="22px" className="rounded-full opacity-80" />
            <SkeletonLine width="85px" height="22px" className="rounded-full opacity-80" />
          </div>

          {/* Action icon buttons placeholder row */}
          <div className="flex items-center gap-1.5 pt-1.5">
            <SkeletonLine width="20px" height="20px" className="rounded-md opacity-50" />
            <SkeletonLine width="20px" height="20px" className="rounded-md opacity-50" />
            <SkeletonLine width="20px" height="20px" className="rounded-md opacity-50" />
            <SkeletonLine width="20px" height="20px" className="rounded-md opacity-50" />
            <div className="ml-2">
              <SkeletonLine width="36px" height="9px" className="rounded opacity-50" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Turn 2: User Inquiry (Right-aligned) ── */}
      <div className="flex flex-col items-end pt-2">
        <div className="bg-accent-soft/70 border border-border/50 rounded-2xl rounded-br-md p-3.5 sm:px-4 max-w-[85%] sm:max-w-[60%] w-[240px] shadow-xs space-y-2">
          <SkeletonLine width="100%" height="13px" className="rounded" />
          <SkeletonLine width="45%" height="13px" className="rounded" />
        </div>
        <div className="mt-1.5 mr-1">
          <SkeletonLine width="42px" height="9px" className="rounded opacity-60" />
        </div>
      </div>

      {/* ── Turn 2: Assistant Response (Left-aligned) ── */}
      <div className="flex items-start gap-3 w-full">
        <div className="skeleton w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2.5 pr-2 sm:pr-8">
          <SkeletonLine width="92%" height="13px" className="rounded" />
          <SkeletonLine width="86%" height="13px" className="rounded" />
          <SkeletonLine width="58%" height="13px" className="rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Backward compatibility alias for SkeletonChatArea
 */
export function SkeletonMessages() {
  return <SkeletonChatArea />;
}
