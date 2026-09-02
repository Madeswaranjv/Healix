import { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { useStore } from '../../store/useStore';

/**
 * Search panel — dropdown from search icon.
 * Input at top, "Recent" list below, live-filters as user types.
 * Empty state: "No conversations match [query]."
 */
export default function SearchPanel({ onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const { conversations, setActiveConversation } = useStore();

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      )
    : conversations.slice(0, 5); // Show recent 5 when no query

  const handleSelect = (id) => {
    setActiveConversation(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-backdrop backdrop-blur-md backdrop-enter"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        ref={panelRef}
        className="relative bg-surface rounded-xl shadow-lg border border-border w-full max-w-2xl p-4 flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 w-full bg-canvas border border-border rounded-lg px-4 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-150 mb-4 shadow-sm">
          <Search size={18} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full text-base text-ink bg-transparent focus:outline-none placeholder:text-muted"
            aria-label="Search conversations"
          />
        </div>

        {/* Label */}
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-2">
          {query.trim() ? 'Results' : 'Recent'}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className="
                    flex items-center gap-3 w-full
                    px-3 py-2.5 rounded-lg
                    text-sm text-ink text-left
                    hover:bg-sidebar-btn-hover
                    transition-colors duration-150
                  "
                >
                  <MessageSquare size={16} className="text-muted flex-shrink-0" />
                  <span className="truncate font-medium">{conv.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted px-2 py-8 text-center">
              No conversations match "{query}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
