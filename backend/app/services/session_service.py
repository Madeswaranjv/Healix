"""Session and conversation history persistence service backed by SQLite."""
import time
import json
import uuid
import logging
from typing import List, Dict, Any, Optional

from app.core.db import get_db_connection
from app.services.vector_service import vector_service
from app.services.chat_history import chat_history_manager

logger = logging.getLogger(__name__)


class SessionService:
    """Manages sessions, messages, and linked documents in SQLite with vectorstore synchronization."""

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        return dict(row)

    def create_session(
        self,
        user_id: str = "user_default",
        title: str = "New Consultation",
        model: str = "",
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates and stores a new conversation session for a user."""
        sid = session_id or f"conv-{int(time.time() * 1000)}"
        now = time.time()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Ensure user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                user_id = "user_default"

            cursor.execute("""
            INSERT INTO sessions (id, user_id, title, model, pinned, message_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (sid, user_id, title, model, 0, 0, now, now))
            conn.commit()

        logger.info(f"Created session '{sid}' for user '{user_id}'")
        return self.get_session(sid)

    def get_or_create_session(
        self,
        session_id: str,
        user_id: str = "user_default",
        title: Optional[str] = None,
        model: str = ""
    ) -> Dict[str, Any]:
        """Retrieves existing session or creates it on-the-fly."""
        session = self.get_session(session_id)
        if session:
            return session
        return self.create_session(
            user_id=user_id,
            title=title or "New Consultation",
            model=model,
            session_id=session_id
        )

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves session details by session ID."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def list_user_sessions(
        self,
        user_id: str = "user_default",
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Lists sessions belonging to a user, ordered by most recently updated."""
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Retroactively update titles for sessions that still say 'New Consultation'
            try:
                cursor.execute("""
                UPDATE sessions
                SET title = (
                    SELECT SUBSTR(m.content, 1, 36)
                    FROM messages m
                    WHERE m.session_id = sessions.id AND m.role = 'user'
                    ORDER BY m.timestamp ASC
                    LIMIT 1
                )
                WHERE (title IN ('New Consultation', 'Untitled consultation') OR title IS NULL)
                  AND EXISTS (
                      SELECT 1 FROM messages m WHERE m.session_id = sessions.id AND m.role = 'user'
                  );
                """)

                # Clean up empty orphan sessions with 0 messages
                cursor.execute("""
                DELETE FROM sessions 
                WHERE (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id) = 0;
                """)
                conn.commit()
            except Exception as e:
                logger.debug(f"Session cleanup skipped: {e}")

            cursor.execute("""
            SELECT * FROM sessions
            WHERE user_id = ?
            ORDER BY pinned DESC, updated_at DESC
            LIMIT ? OFFSET ?
            """, (user_id, limit, offset))
            rows = cursor.fetchall()
            return [self._row_to_dict(r) for r in rows]

    def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
        model: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Updates session title, pin status, or active model."""
        existing = self.get_session(session_id)
        if not existing:
            return None

        now = time.time()
        set_clauses = ["updated_at = ?"]
        values = [now]

        if title is not None:
            set_clauses.append("title = ?")
            values.append(title.strip())
        if pinned is not None:
            set_clauses.append("pinned = ?")
            values.append(1 if pinned else 0)
        if model is not None:
            set_clauses.append("model = ?")
            values.append(model)

        values.append(session_id)
        query = f"UPDATE sessions SET {', '.join(set_clauses)} WHERE id = ?"

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, values)
            conn.commit()

        return self.get_session(session_id)

    def delete_session(self, session_id: str) -> bool:
        """Deletes session and performs cascading cleanup of vectorstore & memory."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()

        # Clean vector collection & in-memory manager
        vector_service.clear_session_documents(session_id)
        chat_history_manager.clear_history(session_id)
        logger.info(f"Deleted session '{session_id}' and all associated records.")
        return True

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        model: Optional[str] = None,
        sources: Optional[List[Dict[str, Any]]] = None,
        is_emergency: bool = False,
        chunks_used: int = 0,
        message_id: Optional[str] = None,
        user_id: str = "user_default"
    ) -> Dict[str, Any]:
        """Stores a message turn in SQLite and updates session metadata."""
        # Ensure session exists
        self.get_or_create_session(session_id, user_id=user_id, model=model or "")

        msg_id = message_id or f"msg-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
        now = time.time()

        # Clean title candidate if first user message
        title_candidate = None
        if role == "user" and content and content.strip():
            raw_title = content.strip().split("\n")[0]
            clean_title = re.sub(r'^[#*`\-\s]+', '', raw_title).strip()
            if len(clean_title) > 36:
                clean_title = clean_title[:36] + "..."
            title_candidate = clean_title or "Consultation"

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO messages (
                id, session_id, role, content, model, sources,
                is_emergency, chunks_used, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                msg_id,
                session_id,
                role,
                content,
                model,
                json.dumps(sources or []),
                1 if is_emergency else 0,
                chunks_used,
                now
            ))

            # Update session message_count, updated_at, and auto-title if needed
            if title_candidate:
                cursor.execute("""
                UPDATE sessions 
                SET message_count = message_count + 1,
                    updated_at = ?,
                    model = COALESCE(?, model),
                    title = CASE WHEN title IN ('New Consultation', 'Untitled consultation', '') OR title IS NULL THEN ? ELSE title END
                WHERE id = ?
                """, (now, model, title_candidate, session_id))
            else:
                cursor.execute("""
                UPDATE sessions 
                SET message_count = message_count + 1,
                    updated_at = ?,
                    model = COALESCE(?, model)
                WHERE id = ?
                """, (now, model, session_id))

            conn.commit()

        # Also register with in-memory chat_history_manager for instant prompt injection
        chat_history_manager.add_message(
            session_id=session_id,
            role=role,
            content=content,
            model=model
        )

        return {
            "id": msg_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "model": model,
            "sources": sources or [],
            "is_emergency": is_emergency,
            "chunks_used": chunks_used,
            "timestamp": now
        }

    def get_session_messages(
        self,
        session_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieves formatted message history for a session from SQLite."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
            LIMIT ?
            """, (session_id, limit))
            rows = cursor.fetchall()

            messages = []
            for r in rows:
                m = dict(r)
                if "sources" in m and isinstance(m["sources"], str):
                    try:
                        m["sources"] = json.loads(m["sources"])
                    except Exception:
                        m["sources"] = []
                m["is_emergency"] = bool(m.get("is_emergency", 0))
                messages.append(m)
            return messages

    def add_session_document(
        self,
        session_id: str,
        filename: str,
        chunks_count: int,
        user_id: str = "user_default"
    ) -> Dict[str, Any]:
        """Tracks an uploaded document associated with this session."""
        self.get_or_create_session(session_id, user_id=user_id)
        doc_id = f"doc_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = time.time()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO session_documents (id, session_id, filename, chunks_count, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
            """, (doc_id, session_id, filename, chunks_count, now))
            conn.commit()

        return {
            "id": doc_id,
            "session_id": session_id,
            "filename": filename,
            "chunks_count": chunks_count,
            "uploaded_at": now
        }

    def get_session_documents(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieves all documents uploaded to a session."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM session_documents
            WHERE session_id = ?
            ORDER BY uploaded_at ASC
            """, (session_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]


# Singleton instance
session_service = SessionService()
