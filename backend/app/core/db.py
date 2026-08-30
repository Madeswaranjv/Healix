"""SQLite Database connection and schema manager for Healix users and sessions."""
import os
import json
import sqlite3
import logging
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Ensure data directory exists
DB_DIR = Path(settings.CHROMA_PERSIST_DIR).parent
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = DB_DIR / "healix.db"


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with dict-like row factory and foreign keys enabled."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initializes database tables and default user if not already present."""
    logger.info(f"Initializing SQLite database at: {DB_PATH}")
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            preferred_name TEXT NOT NULL,
            email TEXT DEFAULT '',
            password_hash TEXT DEFAULT '',
            auth_token TEXT DEFAULT '',
            age INTEGER DEFAULT NULL,
            gender TEXT DEFAULT '',
            blood_group TEXT DEFAULT '',
            allergies TEXT DEFAULT '[]',
            chronic_conditions TEXT DEFAULT '[]',
            current_medications TEXT DEFAULT '[]',
            emergency_contact TEXT DEFAULT '{}',
            preferences TEXT DEFAULT '{}',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """)

        # Migration helper for existing databases
        cursor.execute("PRAGMA table_info(users)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "password_hash" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''")
        if "auth_token" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN auth_token TEXT DEFAULT ''")

        # 2. Sessions Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            model TEXT DEFAULT '',
            pinned INTEGER DEFAULT 0,
            message_count INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # 3. Messages Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            model TEXT DEFAULT NULL,
            sources TEXT DEFAULT '[]',
            is_emergency INTEGER DEFAULT 0,
            chunks_used INTEGER DEFAULT 0,
            timestamp REAL NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
        """)

        # 4. Session Documents Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS session_documents (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            chunks_count INTEGER DEFAULT 0,
            uploaded_at REAL NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
        """)

        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_docs_session_id ON session_documents(session_id)")

        # Seed default user if not exists
        cursor.execute("SELECT id FROM users WHERE id = 'user_default'")
        if not cursor.fetchone():
            import time
            now = time.time()
            cursor.execute("""
            INSERT INTO users (
                id, full_name, preferred_name, email, age, gender, blood_group,
                allergies, chronic_conditions, current_medications, emergency_contact,
                preferences, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "user_default",
                "Jane Doe",
                "Jane",
                "jane.doe@example.com",
                32,
                "Female",
                "O+",
                json.dumps(["Penicillin"]),
                json.dumps(["Mild Asthma"]),
                json.dumps(["Albuterol inhaler as needed"]),
                json.dumps({"name": "John Doe", "phone": "+1 (555) 234-5678", "relation": "Spouse"}),
                json.dumps({"theme": "light", "fontSize": 16}),
                now,
                now
            ))
            logger.info("Default user 'user_default' created in database.")

        conn.commit()


# Initialize schema on module load
init_db()
