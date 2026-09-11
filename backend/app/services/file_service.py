"""File persistence service backed by SQLite for Healix user file artifacts."""
import time
import uuid
import logging
from typing import List, Dict, Any, Optional

from app.core.db import get_db_connection

logger = logging.getLogger(__name__)


class FileService:
    """Manages user file records (markdown, text, PDF sources) in SQLite."""

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        return dict(row)

    def create_file(
        self,
        user_id: str = "user_default",
        title: str = "Untitled",
        file_type: str = "md",
        content: str = ""
    ) -> Dict[str, Any]:
        """Creates and stores a new file record for a user."""
        file_id = f"file-{uuid.uuid4().hex[:12]}"
        now = time.time()

        # Validate type
        if file_type not in ("md", "txt", "pdf"):
            file_type = "md"

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Ensure user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                user_id = "user_default"

            cursor.execute("""
            INSERT INTO files (id, user_id, title, type, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (file_id, user_id, title, file_type, content, now, now))
            conn.commit()

        logger.info(f"Created file '{file_id}' ({file_type}) for user '{user_id}'")
        return self.get_file(file_id)

    def get_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a file record by ID."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def list_user_files(
        self,
        user_id: str = "user_default",
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Lists all files for a user, ordered by most recently updated."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM files WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                (user_id, limit, offset)
            )
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]

    def update_file(
        self,
        file_id: str,
        content: Optional[str] = None,
        title: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Updates a file's content and/or title."""
        existing = self.get_file(file_id)
        if not existing:
            return None

        now = time.time()
        new_content = content if content is not None else existing["content"]
        new_title = title if title is not None else existing["title"]

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE files SET content = ?, title = ?, updated_at = ? WHERE id = ?",
                (new_content, new_title, now, file_id)
            )
            conn.commit()

        logger.info(f"Updated file '{file_id}'")
        return self.get_file(file_id)

    def delete_file(self, file_id: str) -> bool:
        """Deletes a file record."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
            deleted = cursor.rowcount > 0
            conn.commit()

        if deleted:
            logger.info(f"Deleted file '{file_id}'")
        return deleted


# Singleton instance
file_service = FileService()
