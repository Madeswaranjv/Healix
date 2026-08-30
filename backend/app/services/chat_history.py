"""In-memory session chat history manager for multi-turn conversation memory."""
import time
import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class ChatHistoryManager:
    """Manages multi-turn conversation history per session in memory."""

    def __init__(self, max_history_per_session: int = 20, max_char_budget: int = 6000):
        # session_id -> list of message dicts
        self._history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        # session_id -> last active timestamp
        self._last_active: Dict[str, float] = {}
        self.max_history_per_session = max_history_per_session
        self.max_char_budget = max_char_budget

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        model: Optional[str] = None
    ) -> None:
        """Appends a message to the session's chat history.
        
        Args:
            session_id: The unique session identifier
            role: 'user' or 'assistant'
            content: The text content of the message
            model: Optional model identifier used for this response
        """
        if not session_id or not content:
            return

        message_entry = {
            "role": role,
            "content": content,
            "model": model,
            "timestamp": time.time()
        }
        self._history[session_id].append(message_entry)
        self._last_active[session_id] = time.time()

        # Trim excess messages beyond configured capacity
        if len(self._history[session_id]) > self.max_history_per_session * 2:
            self._history[session_id] = self._history[session_id][-self.max_history_per_session * 2:]

        logger.debug(
            f"Stored message for session '{session_id}' [{role}]. "
            f"Total history count: {len(self._history[session_id])}"
        )

    def get_prompt_history(
        self,
        session_id: str,
        max_messages: Optional[int] = None
    ) -> List[Dict[str, str]]:
        """Returns sanitized history formatted for OpenAI/OpenRouter messages payload.
        Respects message count limit and token/character budget.
        
        Args:
            session_id: The unique session identifier
            max_messages: Max number of turns to retrieve (defaults to self.max_history_per_session)
            
        Returns:
            List of {"role": "user"|"assistant", "content": "..."}
        """
        limit = max_messages or self.max_history_per_session
        raw_msgs = self._history.get(session_id, [])
        if not raw_msgs:
            return []

        # Take last N messages
        recent_msgs = raw_msgs[-limit:]

        # Filter and enforce character budget from newest to oldest
        selected_msgs = []
        current_chars = 0

        for msg in reversed(recent_msgs):
            content = msg.get("content", "").strip()
            role = msg.get("role", "user")
            
            # Skip empty or emergency notices prepended
            if not content:
                continue

            msg_len = len(content)
            if current_chars + msg_len > self.max_char_budget and len(selected_msgs) > 0:
                # If budget exceeded, stop taking older messages
                break

            selected_msgs.append({"role": role, "content": content})
            current_chars += msg_len

        # Reverse back to chronological order (oldest to newest)
        selected_msgs.reverse()
        return selected_msgs

    def get_full_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Returns full session conversation history with metadata."""
        return list(self._history.get(session_id, []))

    def clear_history(self, session_id: str) -> bool:
        """Clears all conversation history for a session."""
        if session_id in self._history:
            del self._history[session_id]
            self._last_active.pop(session_id, None)
            logger.info(f"Cleared chat history for session '{session_id}'")
            return True
        return False

    def cleanup_idle_sessions(self, max_idle_seconds: int = 7200) -> int:
        """Removes sessions that haven't been active for max_idle_seconds (default 2 hours)."""
        now = time.time()
        expired_sessions = [
            sid for sid, last_ts in self._last_active.items()
            if (now - last_ts) > max_idle_seconds
        ]
        for sid in expired_sessions:
            self._history.pop(sid, None)
            self._last_active.pop(sid, None)
        
        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} idle conversation histories.")
        return len(expired_sessions)


# Singleton instance
chat_history_manager = ChatHistoryManager()
