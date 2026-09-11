"""Shim re-export for backend/services/bhashini.py matching project structure."""
from app.services.bhashini import (
    bhashini_service,
    BhashiniService,
    detect_language_from_text,
    clean_text_for_tts,
)

__all__ = [
    "bhashini_service",
    "BhashiniService",
    "detect_language_from_text",
    "clean_text_for_tts",
]
