import { useState, useMemo } from 'react';
import { Search, MessageSquare, MoreVertical, Pencil, FileDown, Trash2, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';

/**
 * /conversations — All conversations page.
 * Search bar, Today/Previous 7 days/Older grouping,
 * rename/export/delete per row.
 */

function groupByRecency(conversations) {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const sevenDaysAgo = todayStart - 7 * dayMs;

  const groups = { today: [], week: [], older: [] };
  conversations.forEach((conv) => {
    if (conv.updatedAt >= todayStart) groups.today.push(conv);
    else if (conv.updatedAt >= sevenDaysAgo) groups.week.push(conv);
    else groups.older.push(conv);
  });
  return groups;
}

function ConversationRow({ conv, onSelect, onDelete, onRename }) {
  const [showMenu, setShowMenu] = useState(false);

  const date = new Date(conv.updatedAt);
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 hover:bg-accent-soft/40 rounded-lg transition-colors duration-150 cursor-pointer">
      <button
        onClick={() => onSelect(conv.id)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <MessageSquare size={18} className="text-muted flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{conv.title}</p>
          <p className="text-xs text-muted font-mono mt-0.5">
            {dateStr} at {timeStr} · {conv.messageCount} messages
          </p>
        </div>
      </button>

      {/* Kebab */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded text-muted hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          aria-label="Conversation options"
        >
          <MoreVertical size={16} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-30 flyout-menu min-w-[150px]">
            <button
              className="flyout-item"
              onClick={() => {
                const newTitle = prompt('New title:', conv.title);
                if (newTitle?.trim()) onRename(conv.id, newTitle.trim());
                setShowMenu(false);
              }}
            >
              <Pencil size={14} className="text-muted" />
              <span>Rename</span>
            </button>
            <button className="flyout-item" onClick={() => setShowMenu(false)}>
              <FileDown size={14} className="text-muted" />
              <span>Export</span>
            </button>
            <div className="my-1 border-t border-border" />
            <button
              className="flyout-item text-alert"
              onClick={() => {
                onDelete(conv.id);
                setShowMenu(false);
              }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllConversationsPage() {
  const [query, setQuery] = useState('');
  const {
    conversations,
    setActiveConversation,
    deleteConversation,
    renameConversation,
  } = useStore();

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [conversations, query]);

  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  const handleSelect = (id) => {
    setActiveConversation(id);
    // Navigate back to chat
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[760px] mx-auto px-4 py-8">
        {/* Back link */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors duration-150 mb-6"
        >
          <ArrowLeft size={16} />
          <span>Back to chat</span>
        </a>

        {/* Header */}
        <h1 className="text-2xl font-semibold text-ink mb-6">All conversations</h1>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="
              w-full pl-10 pr-4 py-2.5
              text-sm text-ink
              bg-surface border border-border rounded-lg
              placeholder:text-muted
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
              transition-colors duration-150
            "
          />
        </div>

        {/* Conversations list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted text-sm">
              {query.trim()
                ? `No conversations match "${query}".`
                : 'No conversations yet. Start a new chat to get started.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.today.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-1">Today</h2>
                {groups.today.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    onSelect={handleSelect}
                    onDelete={deleteConversation}
                    onRename={renameConversation}
                  />
                ))}
              </>
            )}
            {groups.week.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-1">Previous 7 days</h2>
                {groups.week.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    onSelect={handleSelect}
                    onDelete={deleteConversation}
                    onRename={renameConversation}
                  />
                ))}
              </>
            )}
            {groups.older.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-1">Older</h2>
                {groups.older.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    onSelect={handleSelect}
                    onDelete={deleteConversation}
                    onRename={renameConversation}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
