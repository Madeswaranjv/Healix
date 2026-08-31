import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

/**
 * Scrollable message list with aria-live region for new assistant messages.
 * Only scrolls when a new user message is submitted, never auto-jumps during LLM streaming.
 */
export default function MessageList({ messages, onResend, onEdit }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const prevCountRef = useRef(messages.length);

  // Scroll only when a new user prompt is submitted, not on streaming deltas
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const latestMsg = messages[messages.length - 1];
      if (latestMsg?.role === 'user') {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

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
