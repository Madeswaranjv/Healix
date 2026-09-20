"""SQLAlchemy Models for Healix Healthcare Platform.

Defines the relational schema for Users, Clinical Profiles, Conversations,
Messages, Documents, User Files, and Authentication Sessions.
Uses PostgreSQL JSONB with fallback to standard JSON for compatibility.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, declarative_base

from app.core.database import Base

# Universal JSON type: Uses PostgreSQL native JSONB for performance & indexing,
# and falls back to standard JSON on other engines (e.g. SQLite test runners).
JSONType = JSONB().with_variant(JSON(), "sqlite")


class User(Base):
    """User account entity for authentication and identity management."""
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False, default="Jane Doe")
    preferred_name = Column(String(100), nullable=False, default="Jane")
    auth_provider = Column(String(50), nullable=False, default="local")
    status = Column(String(50), nullable=False, default="active")
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    clinical_profile = relationship(
        "ClinicalProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )
    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(Conversation.updated_at)"
    )
    documents = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    files = relationship(
        "UserFile",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(UserFile.updated_at)"
    )
    auth_sessions = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} name={self.preferred_name}>"


class ClinicalProfile(Base):
    """Patient medical and health properties linked 1-to-1 with a User."""
    __tablename__ = "clinical_profiles"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    
    age = Column(Integer, nullable=True)
    gender = Column(String(50), nullable=True, default="")
    blood_group = Column(String(20), nullable=True, default="")
    allergies = Column(JSONType, nullable=False, default=list)
    chronic_conditions = Column(JSONType, nullable=False, default=list)
    current_medications = Column(JSONType, nullable=False, default=list)
    emergency_contact = Column(JSONType, nullable=False, default=dict)
    preferences = Column(JSONType, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationship back to User
    user = relationship("User", back_populates="clinical_profile")

    def __repr__(self) -> str:
        return f"<ClinicalProfile id={self.id} user_id={self.user_id}>"


class Conversation(Base):
    """Multi-turn healthcare consultation session owned by a User."""
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title = Column(String(255), nullable=False, default="New Consultation")
    model = Column(String(100), nullable=True, default="")
    pinned = Column(Boolean, nullable=False, default=False)
    message_count = Column(Integer, nullable=False, default=0)
    meta_data = Column("metadata", JSONType, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True
    )

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )
    documents = relationship(
        "Document",
        back_populates="conversation",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_conversations_user_updated", "user_id", "updated_at"),
        Index("idx_conversations_user_pinned", "user_id", "pinned"),
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} user_id={self.user_id} title={self.title[:20]}>"


class Message(Base):
    """Single turn (user prompt or assistant response) within a Conversation."""
    __tablename__ = "messages"

    id = Column(String(64), primary_key=True, index=True)
    conversation_id = Column(
        String(64),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role = Column(String(50), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    model = Column(String(100), nullable=True)
    sources = Column(JSONType, nullable=False, default=list)
    is_emergency = Column(Boolean, nullable=False, default=False)
    chunks_used = Column(Integer, nullable=False, default=0)
    meta_data = Column("metadata", JSONType, nullable=False, default=dict)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )

    # Relationship back to Conversation
    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_conv_created", "conversation_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} role={self.role} conv={self.conversation_id}>"


class Document(Base):
    """Clinical document record uploaded to a session or user repository."""
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, index=True)
    conversation_id = Column(
        String(64),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True)  # 'pdf', 'docx', 'txt', 'image'
    chunks_count = Column(Integer, nullable=False, default=0)
    processing_status = Column(String(50), nullable=False, default="indexed")
    storage_path = Column(String(500), nullable=True)
    meta_data = Column("metadata", JSONType, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="documents")
    user = relationship("User", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document id={self.id} filename={self.filename} chunks={self.chunks_count}>"


class UserFile(Base):
    """User-created file artifact (markdown clinical notes, reports, summaries)."""
    __tablename__ = "user_files"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title = Column(String(255), nullable=False, default="Untitled")
    type = Column(String(50), nullable=False, default="md")
    content = Column(Text, nullable=False, default="")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True
    )

    # Relationship back to User
    user = relationship("User", back_populates="files")

    def __repr__(self) -> str:
        return f"<UserFile id={self.id} title={self.title} user_id={self.user_id}>"


class AuthSession(Base):
    """Authentication session or bearer token record for active logins."""
    __tablename__ = "auth_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    token = Column(String(255), unique=True, nullable=False, index=True)
    token_type = Column(String(50), nullable=False, default="bearer")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationship back to User
    user = relationship("User", back_populates="auth_sessions")

    def __repr__(self) -> str:
        return f"<AuthSession id={self.id} user_id={self.user_id} revoked={self.revoked}>"
