"""User authentication and profile management service with clinical/health properties."""
import time
import json
import uuid
import hashlib
import secrets
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.core.db import get_db_connection

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hashes password using PBKDF2 with SHA-256 and unique cryptographic salt."""
    if not password:
        return ""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"{salt}${pw_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies plain password against stored salted hash."""
    if not stored_hash:
        return True  # Allows demo account access without password
    try:
        salt, pw_hash = stored_hash.split("$", 1)
        test_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
        return secrets.compare_digest(pw_hash, test_hash)
    except Exception:
        return False


class UserProfileModel(BaseModel):
    """Pydantic model representing a User profile and health attributes."""
    id: str
    full_name: str = "Jane Doe"
    preferred_name: str = "Jane"
    email: str = ""
    age: Optional[int] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    emergency_contact: Dict[str, str] = Field(default_factory=dict)
    preferences: Dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class UserService:
    """Provides authentication, CRUD operations, and clinical summary generation for users."""

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        """Converts SQLite Row to dictionary with parsed JSON fields."""
        if not row:
            return None
        d = dict(row)
        for json_field in ["allergies", "chronic_conditions", "current_medications", "emergency_contact", "preferences"]:
            if json_field in d and isinstance(d[json_field], str):
                try:
                    d[json_field] = json.loads(d[json_field])
                except Exception:
                    d[json_field] = [] if "list" in json_field or json_field in ["allergies", "chronic_conditions", "current_medications"] else {}
        return d

    def get_user(self, user_id: str = "user_default") -> Optional[Dict[str, Any]]:
        """Retrieves a user by ID."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user by email address."""
        if not email:
            return None
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),))
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user by active authentication token."""
        if not token:
            return None
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE auth_token = ?", (token.strip(),))
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def get_or_create_default_user(self) -> Dict[str, Any]:
        """Retrieves default user or creates one if missing."""
        user = self.get_user("user_default")
        if user:
            return user
        return self.create_user(
            user_id="user_default",
            full_name="Jane Doe, MD",
            preferred_name="Dr. Jane",
            email="jane.doe@healix.ai",
            age=34,
            gender="Female",
            blood_group="O+"
        )

    def list_users(self) -> List[Dict[str, Any]]:
        """Lists all registered users (excluding sensitive password hash)."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users ORDER BY created_at ASC")
            rows = cursor.fetchall()
            users = []
            for r in rows:
                ud = self._row_to_dict(r)
                if ud:
                    ud.pop("password_hash", None)
                    users.append(ud)
            return users

    def create_user(
        self,
        user_id: Optional[str] = None,
        full_name: str = "User",
        preferred_name: str = "User",
        email: str = "",
        password: str = "",
        age: Optional[int] = None,
        gender: str = "",
        blood_group: str = "",
        allergies: Optional[List[str]] = None,
        chronic_conditions: Optional[List[str]] = None,
        current_medications: Optional[List[str]] = None,
        emergency_contact: Optional[Dict[str, str]] = None,
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Creates a new user profile with hashed password and healthcare properties."""
        uid = user_id or f"usr_{uuid.uuid4().hex[:10]}"
        now = time.time()
        pw_hash = hash_password(password) if password else ""
        token = secrets.token_hex(24)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO users (
                id, full_name, preferred_name, email, password_hash, auth_token, age, gender, blood_group,
                allergies, chronic_conditions, current_medications, emergency_contact,
                preferences, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                uid,
                full_name,
                preferred_name or full_name.split()[0],
                email,
                pw_hash,
                token,
                age,
                gender,
                blood_group,
                json.dumps(allergies or []),
                json.dumps(chronic_conditions or []),
                json.dumps(current_medications or []),
                json.dumps(emergency_contact or {}),
                json.dumps(preferences or {}),
                now,
                now
            ))
            conn.commit()

        user = self.get_user(uid)
        return user

    def authenticate(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticates user with email and password, returning user dict + token if valid."""
        user = self.get_user_by_email(email)
        if not user:
            # Check if default user matches email or name
            if email in ("jane.doe@example.com", "jane.doe@healix.ai", "user_default", "demo"):
                user = self.get_or_create_default_user()
            else:
                return None

        # Verify password
        stored_hash = user.get("password_hash", "")
        if stored_hash and not verify_password(password, stored_hash):
            return None

        # Generate fresh token
        token = secrets.token_hex(24)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET auth_token = ?, updated_at = ? WHERE id = ?", (token, time.time(), user["id"]))
            conn.commit()

        user_data = self.get_user(user["id"])
        user_data["token"] = token
        user_data.pop("password_hash", None)
        return user_data

    def logout(self, token_or_user_id: str) -> bool:
        """Invalidates active token on logout."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET auth_token = '' WHERE auth_token = ? OR id = ?",
                (token_or_user_id, token_or_user_id)
            )
            conn.commit()
        return True

    def update_user(self, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates user profile and health fields."""
        existing = self.get_user(user_id)
        if not existing:
            return None

        now = time.time()
        allowed_fields = [
            "full_name", "preferred_name", "email", "age", "gender",
            "blood_group", "allergies", "chronic_conditions",
            "current_medications", "emergency_contact", "preferences"
        ]

        set_clauses = ["updated_at = ?"]
        values = [now]

        if "password" in updates and updates["password"]:
            set_clauses.append("password_hash = ?")
            values.append(hash_password(updates["password"]))

        for field in allowed_fields:
            if field in updates:
                val = updates[field]
                if field in ["allergies", "chronic_conditions", "current_medications", "emergency_contact", "preferences"]:
                    values.append(json.dumps(val))
                else:
                    values.append(val)
                set_clauses.append(f"{field} = ?")

        values.append(user_id)

        query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, values)
            conn.commit()

        return self.get_user(user_id)

    def get_user_health_summary(self, user_id: str) -> str:
        """Generates a concise, structured health summary string for prompt injection."""
        user = self.get_user(user_id)
        if not user:
            return ""

        parts = []
        if user.get("preferred_name"):
            parts.append(f"Patient Name: {user['preferred_name']}")
        if user.get("age"):
            parts.append(f"Age: {user['age']}")
        if user.get("gender"):
            parts.append(f"Gender: {user['gender']}")
        if user.get("blood_group"):
            parts.append(f"Blood Group: {user['blood_group']}")

        allergies = user.get("allergies", [])
        if allergies:
            parts.append(f"Known Allergies: {', '.join(allergies)}")

        conditions = user.get("chronic_conditions", [])
        if conditions:
            parts.append(f"Chronic Health Conditions: {', '.join(conditions)}")

        medications = user.get("current_medications", [])
        if medications:
            parts.append(f"Current Medications: {', '.join(medications)}")

        if not parts:
            return ""

        return " | ".join(parts)


# Singleton instance
user_service = UserService()
