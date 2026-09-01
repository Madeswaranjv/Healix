import { useState, useRef, useEffect } from 'react';
import { MessageSquare, MoreVertical, Pencil, FileDown, Trash2, Check, X } from 'lucide-react';

/**
 * Individual chat list item.
 * Hover reveals kebab menu: Rename, Export, Delete.
 * Selected state: accent-soft background.
 */
export default function ChatListItem({ conversation, isActive, onSelect, onDelete, onRename }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Auto-focus rename input
  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onRename(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setRenameValue(conversation.title);
      setIsRenaming(false);
    }
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 mx-2">
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleRenameSubmit}
          className="
            flex-1 px-2 py-1 text-sm text-ink
            bg-canvas border border-primary rounded
            focus:outline-none
          "
          aria-label="Rename conversation"
        />
        <button
          onClick={handleRenameSubmit}
          className="p-1 text-muted hover:text-ink active:text-ink rounded"
          aria-label="Confirm rename"
        >
          <Check size={12} />
        </button>
        <button
          onClick={() => {
            setRenameValue(conversation.title);
            setIsRenaming(false);
          }}
          className="p-1 text-muted hover:text-ink active:text-ink rounded"
          aria-label="Cancel rename"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative group px-2">
      <button
        onClick={onSelect}
        className={`
          flex items-center gap-2.5 w-full
          px-3 py-2 rounded-lg
          text-sm text-left
          transition-colors duration-150 ease-out
          ${isActive
            ? 'bg-sidebar-icon-active text-ink'
            : 'text-ink hover:bg-sidebar-icon-hover'
          }
        `}
        aria-current={isActive ? 'true' : undefined}
      >
        <MessageSquare
          size={14}
          className={`flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}
        />
        <span className="truncate flex-1">{conversation.title}</span>
      </button>

      {/* Kebab menu trigger — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="
          absolute right-3 top-1/2 -translate-y-1/2
          p-1 rounded
          text-muted hover:text-ink active:text-ink
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        "
        aria-label="Conversation options"
      >
        <MoreVertical size={12} />
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-2 top-full mt-1 z-30 flyout-menu min-w-[160px]"
          role="menu"
        >
          <button
            className="flyout-item"
            onClick={() => {
              setShowMenu(false);
              setIsRenaming(true);
            }}
            role="menuitem"
          >
            <Pencil size={12} className="text-muted" />
            <span>Rename</span>
          </button>
          <button
            className="flyout-item"
            onClick={() => {
              // TODO(backend): Implement export
              setShowMenu(false);
            }}
            role="menuitem"
          >
            <FileDown size={12} className="text-muted" />
            <span>Export</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            className="flyout-item text-alert hover:!bg-sidebar-danger-hover"
            onClick={() => {
              onDelete();
              setShowMenu(false);
            }}
            role="menuitem"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
