"""Shim re-export for backend/routes/voice.py matching deliverables list."""
from app.routes.voice import (
    router,
    TTSRequest,
    TTSResponse,
    STTResponse,
    SUPPORTED_VOICE_LANGUAGES,
)

__all__ = [
    "router",
    "TTSRequest",
    "TTSResponse",
    "STTResponse",
    "SUPPORTED_VOICE_LANGUAGES",
]
