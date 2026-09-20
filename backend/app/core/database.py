"""PostgreSQL / Neon Database Configuration Module for Healix.

This module provides lazy configuration, engine initialization, and session
factories for Neon PostgreSQL. It reads DATABASE_URL from settings without
eagerly establishing a connection or running table creation at import time.
"""

import logging
from typing import Generator, Optional
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.config import settings

logger = logging.getLogger(__name__)

# Base class for future SQLAlchemy models (deferred)
Base = declarative_base()

# Lazy singletons (not initialized until explicitly requested)
_engine: Optional[Engine] = None
_SessionFactory: Optional[sessionmaker] = None


def get_database_url() -> Optional[str]:
    """Retrieves and normalizes the DATABASE_URL.
    
    Returns None if unconfigured or still set to a placeholder value.
    Normalizes 'postgres://' schema prefix to 'postgresql://' for SQLAlchemy 2.0.
    """
    raw_url = (settings.DATABASE_URL or "").strip()
    if not raw_url:
        return None
    if "PASTE_NEON_CONNECTION_STRING" in raw_url or raw_url == "PASTE_NEON_CONNECTION_STRING_HERE":
        return None
    
    # SQLAlchemy requires postgresql:// instead of postgres://
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        
    return raw_url


def is_database_configured() -> bool:
    """Checks whether a valid database connection string is configured."""
    return get_database_url() is not None


def get_safe_db_info() -> dict:
    """Returns safe connection metadata (host, port, db name) without leaking credentials."""
    url = get_database_url()
    if not url:
        return {"configured": False, "status": "Not configured or placeholder value"}
    try:
        parsed = urlparse(url)
        return {
            "configured": True,
            "driver": parsed.scheme,
            "host": parsed.hostname or "unknown",
            "port": parsed.port or 5432,
            "database": (parsed.path or "").lstrip("/")
        }
    except Exception:
        return {"configured": True, "status": "Configured (metadata parse error)"}


def get_engine() -> Engine:
    """Lazily creates and caches the SQLAlchemy engine.
    
    Does NOT connect immediately; connection pool is established when
    the first transaction/query is executed.
    """
    global _engine
    if _engine is None:
        url = get_database_url()
        if not url:
            raise ValueError(
                "DATABASE_URL is not configured. Please set a valid PostgreSQL connection string "
                "in backend/.env before accessing the database."
            )
        # Optimized connection pooling for cloud-hosted Neon Postgres
        _engine = create_engine(
            url,
            pool_pre_ping=True,      # Automatically test connections before checkout
            pool_recycle=300,        # Recycle connections every 5 minutes to prevent stale dropped sockets
            pool_size=5,             # Sensible pool size for serverless Neon
            max_overflow=10
        )
        safe_info = get_safe_db_info()
        logger.info(f"Database engine initialized for host={safe_info.get('host')}, db={safe_info.get('database')}")
    return _engine


def get_session_factory() -> sessionmaker:
    """Lazily creates and caches the sessionmaker factory."""
    global _SessionFactory
    if _SessionFactory is None:
        engine = get_engine()
        _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionFactory


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session per request.
    
    Yields an active session and ensures it is closed after request completion.
    """
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
