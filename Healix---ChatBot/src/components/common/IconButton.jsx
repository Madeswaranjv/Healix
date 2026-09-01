import { forwardRef } from 'react';

/**
 * Reusable icon button with aria-label, focus ring, and hover states.
 * Used throughout the sidebar and canvas for icon-only actions.
 */
const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, onClick, size = 20, className = '', active = false, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        w-7 h-7 rounded-md
        transition-colors duration-150 ease-out
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        ${
          active
            ? 'text-ink bg-sidebar-icon-active'
            : 'text-muted hover:text-ink active:text-ink hover:bg-sidebar-icon-hover'
        }
        ${className}
      `}
      aria-label={label}
      {...props}
    >
      <Icon size={size} />
    </button>
  );
});

export default IconButton;
