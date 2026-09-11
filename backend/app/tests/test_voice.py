"""Automated tests for Voice I/O Integration (Bhashini TTS & STT)."""

import io
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.bhashini import (
    bhashini_service,
    detect_language_from_text,
    clean_text_for_tts
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_language_detection():
    """Verify Unicode-based Indian language detection."""
    # Tamil
    tamil_text = "வணக்கம், உங்கள் உடல்நிலை எவ்வாறு உள்ளது? இரத்த அழுத்தம் சீராக உள்ளதா?"
    assert detect_language_from_text(tamil_text) == "ta"

    # Hindi
    hindi_text = "नमस्ते, आपका स्वास्थ्य कैसा है? क्या आपको बुखार है?"
    assert detect_language_from_text(hindi_text) == "hi"

    # Telugu
    telugu_text = "నమస్కారం, మీ ఆరోగ్యం ఎలా ఉంది?"
    assert detect_language_from_text(telugu_text) == "te"

    # English
    english_text = "The patient presents with mild hypertension and elevated systolic pressure."
    assert detect_language_from_text(english_text) == "en"


def test_text_cleaning_for_tts():
    """Verify markdown formatting is cleanly removed for natural speech synthesis."""
    raw_markdown = (
        "## Clinical Summary\n\n"
        "Here are **critical recommendations**:\n"
        "- Maintain **adequate hydration** (2-3 liters/day)\n"
        "- Review the [clinical guidelines](https://example.com/guidelines)\n"
        "```python\nprint('code to ignore')\n```\n"
        "| Test | Result |\n| BP | 120/80 |"
    )
    cleaned = clean_text_for_tts(raw_markdown)
    assert "##" not in cleaned
    assert "**" not in cleaned
    assert "print('code to ignore')" not in cleaned
    assert "https://" not in cleaned
    assert "clinical guidelines" in cleaned
    assert "adequate hydration" in cleaned


def test_wav_passthrough():
    """Verify raw WAV bytes are detected and passed through directly."""
    # Standard dummy 44-byte WAV header
    wav_header = b"RIFF" + (36).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + (16000).to_bytes(4, "little") + (32000).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little") + b"data" + (0).to_bytes(4, "little")
    result = bhashini_service.transcode_to_wav(wav_header)
    assert result == wav_header


def test_voice_languages_endpoint(client):
    """Test /api/voice/languages returns supported languages."""
    res = client.get("/api/voice/languages")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "languages" in data
    codes = [item["code"] for item in data["languages"]]
    assert "ta" in codes
    assert "en" in codes
    assert "hi" in codes


def test_tts_unconfigured_error_handling(client):
    """Test /api/voice/tts returns 503 when credentials are not configured."""
    with patch.object(bhashini_service, "is_configured", return_value=False):
        res = client.post("/api/voice/tts", json={"text": "Hello patient", "language": "en"})
        assert res.status_code == 503
        assert "credentials" in res.json()["detail"].lower()


def test_stt_unconfigured_error_handling(client):
    """Test /api/voice/stt returns 503 when credentials are not configured."""
    with patch.object(bhashini_service, "is_configured", return_value=False):
        dummy_file = io.BytesIO(b"RIFFdummydata")
        res = client.post(
            "/api/voice/stt",
            files={"file": ("test.wav", dummy_file, "audio/wav")},
            data={"language": "ta"}
        )
        assert res.status_code == 503
        assert "credentials" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_mocked_tts_inference_flow(client):
    """Test end-to-end TTS endpoint with mocked Bhashini responses."""
    mock_audio_base64 = "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    
    with patch.object(bhashini_service, "is_configured", return_value=True), \
         patch.object(bhashini_service, "text_to_speech", new_callable=AsyncMock) as mock_tts:
        
        mock_tts.return_value = {
            "audioContent": mock_audio_base64,
            "format": "wav",
            "language": "en"
        }

        res = client.post(
            "/api/voice/tts",
            json={"text": "Please take your medications on time.", "language": "en"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["audioContent"] == mock_audio_base64
        assert data["language"] == "en"


@pytest.mark.asyncio
async def test_mocked_stt_inference_flow(client):
    """Test end-to-end STT endpoint with mocked Bhashini responses."""
    expected_transcript = "எனக்கு தலைவலி உள்ளது"
    
    with patch.object(bhashini_service, "is_configured", return_value=True), \
         patch.object(bhashini_service, "speech_to_text", new_callable=AsyncMock) as mock_stt:
        
        mock_stt.return_value = {
            "transcript": expected_transcript,
            "language": "ta"
        }

        fake_audio = b"RIFF" + (36).to_bytes(4, "little") + b"WAVE" + b"\x00" * 32
        res = client.post(
            "/api/voice/stt",
            files={"file": ("recording.wav", io.BytesIO(fake_audio), "audio/wav")},
            data={"language": "ta"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["transcript"] == expected_transcript
        assert data["language"] == "ta"
