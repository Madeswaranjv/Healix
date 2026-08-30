import { useState } from 'react';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import ChatListItem from './ChatListItem';
import ChatFilterMenu from './ChatFilterMenu';
import { useStore } from '../../store/useStore';
import IconButton from '../common/IconButton';

/**
 * Chats list.
 * Section label "Chats" with a filter icon.
 * Max 15 items, then "View all conversations" link.
 */

export default function ChatList({ onNavigate }) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    renameConversation,
  } = useStore();

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Limit to 15 items total for sidebar
  const showViewAll = conversations.length > 15;
  const limitedConversations = conversations.slice(0, 15);

  const handleSelect = (id) => {
    setActiveConversation(id);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full py-2">
      {/* Section label with filter icon */}
      <div className="flex-none flex items-center justify-between px-4 py-1.5 relative">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Chats
        </span>
        
        <IconButton 
          icon={SlidersHorizontal} 
          label="Filter and Sort" 
          onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
          active={isFilterMenuOpen}
        />
        
        {isFilterMenuOpen && (
          <ChatFilterMenu onClose={() => setIsFilterMenuOpen(false)} />
        )}
      </div>

      {/* Flat list */}
      <div className="flex-1 overflow-y-auto transition-all duration-300 ease-out opacity-100 mt-2">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted px-4 py-6 text-center">
            No conversations yet. Start a new chat.
          </p>
        ) : (
          <>
            {limitedConversations.map((conv) => (
              <ChatListItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={() => handleSelect(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
                onRename={(title) => renameConversation(conv.id, title)}
              />
            ))}

            {/* View all conversations link */}
            {showViewAll && (
              <a
                href="/conversations"
                className="
                  flex items-center gap-2
                  px-4 py-2.5 mt-1
                  text-sm text-primary font-medium
                  hover:bg-sidebar-icon-hover
                  transition-colors duration-150
                "
              >
                <span>View all conversations</span>
                <ArrowRight size={14} />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
