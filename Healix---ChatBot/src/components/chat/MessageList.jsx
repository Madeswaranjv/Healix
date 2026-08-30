import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

/**
 * Scrollable message list with aria-live region for new assistant messages.
 * Auto-scrolls to bottom on new messages.
 */
export default function MessageList({ messages, onResend, onEdit }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages and streaming token deltas
  const latestContent = messages.length > 0 ? messages[messages.length - 1].content : '';
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, latestContent]);

  return (
    <div ref={containerRef} className="py-6 space-y-1">
      {/* Aria-live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <span>New response from Healix</span>
        )}
      </div>

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onResend={onResend}
          onEdit={onEdit}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
