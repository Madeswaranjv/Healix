import { useCallback, useEffect, useRef } from 'react';

/**
 * Vertical drag handle for resizing the Files panel.
 * Renders a thin visible bar on the left edge of the panel.
 */
export default function ResizeHandle({ onResize, minWidth = 340, maxWidth = 900 }) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    // Get the panel's current width from the parent
    const panel = e.target.closest('[data-files-panel]');
    if (panel) {
      startWidth.current = panel.offsetWidth;
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      // Panel is on the right, so dragging left = wider
      const delta = startX.current - e.clientX;
      const maxAllowed = Math.min(maxWidth, window.innerWidth * 0.45);
      const newWidth = Math.max(minWidth, Math.min(maxAllowed, startWidth.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, minWidth, maxWidth]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="
        absolute left-0 top-0 bottom-0 w-1.5 z-30
        cursor-col-resize group
        flex items-center justify-center
      "
      title="Drag to resize"
    >
      {/* Visible drag indicator */}
      <div className="
        w-[3px] h-10 rounded-full
        text-black dark:text-white opacity-60 group-hover:opacity-100
        transition-opacity duration-150
      " />
    </div>
  );
}
