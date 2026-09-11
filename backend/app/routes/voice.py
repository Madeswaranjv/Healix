"""Voice API routes for Healix: Text-to-Speech (TTS) and Speech-to-Text (STT) via Bhashini."""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field

from app.services.bhashini import bhashini_service

logger = logging.getLogger("healix-voice-routes")

router = APIRouter()


class TTSRequest(BaseModel):
    """Request payload for Text-to-Speech conversion."""
    text: str = Field(..., min_length=1, description="Text to synthesize into speech")
    language: Optional[str] = Field(
        default="en",
        description="Target language code (en, ta, hi, te, kn, ml, etc.) or 'auto'"
    )
    gender: Optional[str] = Field(default="female", description="Voice gender: female or male")


class TTSResponse(BaseModel):
    """Response payload containing base64 audio content."""
    status: str = "success"
    audioContent: str = Field(..., description="Base64-encoded audio (WAV format)")
    format: str = "wav"
    language: str


class STTResponse(BaseModel):
    """Response payload containing transcribed speech."""
    status: str = "success"
    transcript: str = Field(..., description="Transcribed text from speech")
    language: str


SUPPORTED_VOICE_LANGUAGES = [
    {"code": "ta", "name": "Tamil", "native": "தமிழ்"},
    {"code": "en", "name": "English", "native": "English"},
    {"code": "hi", "name": "Hindi", "native": "हिन्दी"},
    {"code": "te", "name": "Telugu", "native": "తెలుగు"},
    {"code": "kn", "name": "Kannada", "native": "ಕನ್ನಡ"},
    {"code": "ml", "name": "Malayalam", "native": "മലയാളം"},
    {"code": "bn", "name": "Bengali", "native": "বাংলা"},
    {"code": "gu", "name": "Gujarati", "native": "ગુજરાતી"},
    {"code": "mr", "name": "Marathi", "native": "मराठी"},
    {"code": "pa", "name": "Punjabi", "native": "ਪੰਜਾਬੀ"}
]


@router.get("/languages")
async def get_supported_languages() -> Dict[str, Any]:
    """Returns list of supported Indian languages for voice I/O."""
    return {
        "status": "success",
        "languages": SUPPORTED_VOICE_LANGUAGES,
        "is_configured": bhashini_service.is_configured()
    }


@router.post("/tts", response_model=TTSResponse)
async def text_to_speech_endpoint(request: TTSRequest):
    """
    Converts clinical text into spoken audio via Bhashini TTS.
    Returns base64 WAV audio content.
    """
    if not bhashini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Bhashini credentials are not configured on this server. "
                "Please configure BHASHINI_INFERENCE_API_KEY (or BHASHINI_ULCA_API_KEY) in backend/.env."
            )
        )

    try:
        result = await bhashini_service.text_to_speech(
            text=request.text,
            language=request.language,
            gender=request.gender or "female"
        )
        return TTSResponse(
            status="success",
            audioContent=result["audioContent"],
            format=result.get("format", "wav"),
            language=result["language"]
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice synthesis failed: {str(e)}"
        )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text_endpoint(
    file: UploadFile = File(..., description="Audio file payload (WAV, WEBM, OGG)"),
    language: Optional[str] = Form("ta", description="Speech input language code (default ta)")
):
    """
    Transcribes recorded audio speech into text via Bhashini ASR.
    Supports Dravidian (ta/te/kn/ml), English (en), and multilingual Indian languages.
    """
    if not bhashini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Bhashini credentials are not configured on this server. "
                "Please configure BHASHINI_INFERENCE_API_KEY (or BHASHINI_ULCA_API_KEY) in backend/.env."
            )
        )

    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio recording received."
            )

        result = await bhashini_service.speech_to_text(
            audio_bytes=audio_bytes,
            language=language or "ta",
            content_type=file.content_type
        )

        return STTResponse(
            status="success",
            transcript=result["transcript"],
            language=result["language"]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"STT transcription error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice transcription failed: {str(e)}"
        )
