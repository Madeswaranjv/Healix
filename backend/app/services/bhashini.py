"""Bhashini Voice Service: Client wrapper for Bhashini ULCA TTS & STT (ASR) APIs."""

import io
import re
import time
import base64
import logging
from typing import Dict, Any, Optional, Tuple

import httpx
from app.config import settings

logger = logging.getLogger("healix-bhashini")

# Configure pydub converter to use imageio-ffmpeg executable if system ffmpeg is not found
try:
    import pydub
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        if ffmpeg_exe:
            pydub.AudioSegment.converter = ffmpeg_exe
            logger.info(f"Configured pydub with imageio-ffmpeg binary: {ffmpeg_exe}")
    except Exception as e:
        logger.warning(f"Could not load imageio-ffmpeg binary: {e}")
except ImportError:
    pydub = None
    logger.warning("pydub not installed. Audio transcoding will be limited to pure WAV.")


def detect_language_from_text(text: str) -> str:
    """Detect Indian language or English based on Unicode script ranges."""
    if not text:
        return "en"
    
    counts = {
        "ta": len(re.findall(r"[\u0B80-\u0BFF]", text)),  # Tamil
        "hi": len(re.findall(r"[\u0900-\u097F]", text)),  # Hindi / Devanagari
        "te": len(re.findall(r"[\u0C00-\u0C7F]", text)),  # Telugu
        "kn": len(re.findall(r"[\u0C80-\u0CFF]", text)),  # Kannada
        "ml": len(re.findall(r"[\u0D00-\u0D7F]", text)),  # Malayalam
        "bn": len(re.findall(r"[\u0980-\u09FF]", text)),  # Bengali
        "gu": len(re.findall(r"[\u0A80-\u0AFF]", text)),  # Gujarati
    }
    
    top_lang, max_count = max(counts.items(), key=lambda item: item[1])
    if max_count >= 3:
        return top_lang
    return "en"


def clean_text_for_tts(text: str) -> str:
    """Strip markdown formatting, URLs, and code blocks for smooth speech synthesis."""
    if not text:
        return ""
    
    # Remove code blocks
    cleaned = re.sub(r"```[\s\S]*?```", "", text)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    
    # Remove markdown links, keep text
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    
    # Remove raw URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    
    # Remove markdown headers (#, ##, etc)
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    
    # Remove bold, italic, strikethrough markers
    cleaned = re.sub(r"(\*\*|__)(.*?)\1", r"\2", cleaned)
    cleaned = re.sub(r"(\*|_)(.*?)\1", r"\2", cleaned)
    cleaned = re.sub(r"~~(.*?)~~", r"\1", cleaned)
    
    # Remove table formatting pipes
    cleaned = re.sub(r"\|", " ", cleaned)
    
    # Remove bullet markers
    cleaned = re.sub(r"^\s*[-*+]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*\d+\.\s+", "", cleaned, flags=re.MULTILINE)
    
    # Collapse multiple whitespaces and newlines
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Optimize text length for fast TTS response (cap around ~380 chars at sentence boundary)
    if len(cleaned) > 400:
        matches = list(re.finditer(r"[.!?]\s+", cleaned[:380]))
        if matches and matches[-1].end() >= 160:
            cleaned = cleaned[:matches[-1].end()].strip()
        else:
            # Fall back to nearest word boundary
            words = cleaned[:360].rsplit(" ", 1)
            cleaned = words[0].strip() + "."

    return cleaned


class BhashiniService:
    """Handles Bhashini ULCA pipeline configuration caching and inference for ASR and TTS."""

    def __init__(self):
        # Cache pipeline configs per task:language key -> {config, timestamp}
        self._config_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl_seconds = 86400  # 24 hours

    def get_api_key(self) -> str:
        """Returns whichever Bhashini API key is configured."""
        return (
            (settings.BHASHINI_INFERENCE_API_KEY or "").strip()
            or (settings.BHASHINI_ULCA_API_KEY or "").strip()
            or (settings.BHASHINI_API_KEY or "").strip()
        )

    def is_configured(self) -> bool:
        """Check if any valid Bhashini API key is provided."""
        return bool(self.get_api_key())

    async def get_pipeline_config(self, task: str, language: str) -> Tuple[str, Dict[str, str], Optional[str]]:
        """
        Retrieves the inference callback endpoint and inference API key.
        If User ID is not present or an inference API key is directly provided,
        bypasses the ULCA config step and uses direct pipeline inference.
        Returns (callback_url, auth_headers, service_id).
        """
        api_key = self.get_api_key()
        if not api_key:
            raise ValueError(
                "Bhashini API Key not configured. Please set BHASHINI_INFERENCE_API_KEY "
                "(or BHASHINI_ULCA_API_KEY / BHASHINI_API_KEY) in backend/.env."
            )

        # If User ID is not provided, or an explicit inference key is given, use direct inference!
        user_id = (settings.BHASHINI_USER_ID or "").strip()
        if not user_id or (settings.BHASHINI_INFERENCE_API_KEY or "").strip():
            logger.info("Using direct Bhashini Inference endpoint with Authorization key (no User ID required).")
            direct_headers = {
                "Authorization": api_key,
                "Content-Type": "application/json"
            }
            return settings.BHASHINI_INFERENCE_ENDPOINT, direct_headers, None

        cache_key = f"{task}:{language.lower()}"
        now = time.time()

        if cache_key in self._config_cache:
            cached = self._config_cache[cache_key]
            if now - cached["timestamp"] < self._cache_ttl_seconds:
                logger.debug(f"Using cached Bhashini config for {cache_key}")
                return cached["callback_url"], cached["headers"], cached.get("service_id")

        logger.info(f"Fetching Bhashini pipeline config for task={task}, language={language}")

        payload = {
            "pipelineTasks": [
                {
                    "taskType": task,
                    "config": {
                        "language": {
                            "sourceLanguage": language.lower()
                        }
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": settings.BHASHINI_PIPELINE_ID
            }
        }

        req_headers = {
            "userID": user_id,
            "ulcaApiKey": api_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    settings.BHASHINI_CONFIG_ENDPOINT,
                    json=payload,
                    headers=req_headers
                )
                if resp.status_code != 200:
                    logger.warning(
                        f"Bhashini config failed ({resp.status_code}). Falling back to direct inference with Authorization header."
                    )
                    return settings.BHASHINI_INFERENCE_ENDPOINT, {"Authorization": api_key, "Content-Type": "application/json"}, None

                data = resp.json()

            # Parse endpoint details
            endpoint_info = data.get("pipelineInferenceAPIEndPoint", {})
            callback_url = endpoint_info.get("callbackUrl") or settings.BHASHINI_INFERENCE_ENDPOINT
            api_key_obj = endpoint_info.get("inferenceApiKey", {})

            if isinstance(api_key_obj, dict):
                h_name = api_key_obj.get("name", "Authorization")
                h_val = api_key_obj.get("value", "")
            else:
                h_name = "Authorization"
                h_val = str(api_key_obj) if api_key_obj else api_key

            auth_headers = {
                h_name: h_val,
                "Content-Type": "application/json"
            }
        except Exception as e:
            logger.warning(f"Error fetching pipeline config ({e}), falling back to direct inference endpoint.")
            return settings.BHASHINI_INFERENCE_ENDPOINT, {"Authorization": api_key, "Content-Type": "application/json"}, None

        # Try to find task serviceId from pipelineResponseConfig if provided
        discovered_service_id = None
        for item in data.get("pipelineResponseConfig", []):
            if item.get("taskType") == task:
                configs = item.get("config", [])
                if configs and isinstance(configs, list):
                    discovered_service_id = configs[0].get("serviceId")

        # Save to cache
        self._config_cache[cache_key] = {
            "callback_url": callback_url,
            "headers": auth_headers,
            "service_id": discovered_service_id,
            "timestamp": now
        }

        return callback_url, auth_headers, discovered_service_id

    def _select_asr_service_id(self, language: str, discovered_id: Optional[str] = None) -> str:
        """Selects the optimal ASR service model based on language."""
        lang = language.lower()
        if lang in ["ta", "te", "kn", "ml"]:
            return settings.BHASHINI_ASR_SERVICE_ID or "bhashini/iitm/asr-dravidian--gpu--t4"
        elif lang == "en":
            return "ai4bharat/whisper-medium-en--gpu--t4"
        else:
            return discovered_id or "bhashini/ai4bharat/conformer-multilingual-asr"

    def transcode_to_wav(self, audio_bytes: bytes, input_format: Optional[str] = None) -> bytes:
        """
        Converts audio to 16kHz mono 16-bit PCM WAV.
        If already WAV, returns audio_bytes directly.
        """
        if audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]:
            # Audio is already WAV
            return audio_bytes

        if not pydub:
            # Cannot transcode without pydub
            logger.warning("Audio does not appear to be WAV and pydub is unavailable.")
            return audio_bytes

        try:
            format_hint = (input_format or "").lower()
            if "webm" in format_hint:
                fmt = "webm"
            elif "ogg" in format_hint:
                fmt = "ogg"
            elif "mp3" in format_hint:
                fmt = "mp3"
            elif "wav" in format_hint:
                fmt = "wav"
            else:
                fmt = None

            if fmt:
                segment = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
            else:
                segment = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes))

            # Resample to 16kHz mono 16-bit PCM
            segment = segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)

            out_buffer = io.BytesIO()
            segment.export(out_buffer, format="wav")
            return out_buffer.getvalue()

        except Exception as e:
            logger.warning(f"pydub transcoding failed ({e}), forwarding original bytes: {e}")
            return audio_bytes

    async def text_to_speech(
        self,
        text: str,
        language: Optional[str] = None,
        gender: str = "female"
    ) -> Dict[str, Any]:
        """
        Converts text to speech using Bhashini TTS.
        Returns: { "audioContent": base64_str, "format": "wav", "language": lang }
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty.")

        # Clean markdown formatting
        clean_text = clean_text_for_tts(text)
        if not clean_text:
            raise ValueError("No speakable text found after removing markdown formatting.")

        # Determine language
        target_lang = (language or "auto").lower()
        if target_lang == "auto" or not target_lang:
            target_lang = detect_language_from_text(clean_text)

        logger.info(f"TTS requested for lang={target_lang}, length={len(clean_text)}")

        callback_url, headers, discovered_id = await self.get_pipeline_config("tts", target_lang)
        service_id = settings.BHASHINI_TTS_SERVICE_ID or discovered_id or "Bhashini/IITM/TTS"

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {
                            "sourceLanguage": target_lang
                        },
                        "serviceId": service_id,
                        "gender": gender
                    }
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": clean_text
                    }
                ]
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(callback_url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Bhashini TTS inference error {resp.status_code}: {resp.text}")
                raise RuntimeError(
                    f"Bhashini TTS inference failed ({resp.status_code}): {resp.text}"
                )

            data = resp.json()

        # Parse response
        # Standard format: pipelineResponse[0].audio[0].audioContent
        audio_content = None
        pipeline_resp = data.get("pipelineResponse", [])
        if pipeline_resp:
            audio_items = pipeline_resp[0].get("audio", [])
            if audio_items:
                audio_content = audio_items[0].get("audioContent")

        if not audio_content:
            logger.error(f"No audioContent in Bhashini TTS response: {data}")
            raise RuntimeError("Bhashini TTS did not return audio content.")

        return {
            "audioContent": audio_content,
            "format": "wav",
            "language": target_lang
        }

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        language: str = "ta",
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Converts speech audio to text transcript using Bhashini ASR.
        Returns: { "transcript": str, "language": lang }
        """
        if not audio_bytes:
            raise ValueError("Audio data is empty.")

        target_lang = (language or "ta").lower()
        logger.info(f"STT requested for lang={target_lang}, bytes={len(audio_bytes)}")

        # Ensure audio is 16kHz mono WAV
        wav_bytes = self.transcode_to_wav(audio_bytes, content_type)
        base64_audio = base64.b64encode(wav_bytes).decode("utf-8")

        callback_url, headers, discovered_id = await self.get_pipeline_config("asr", target_lang)
        service_id = self._select_asr_service_id(target_lang, discovered_id)

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {
                            "sourceLanguage": target_lang
                        },
                        "serviceId": service_id,
                        "audioFormat": "wav",
                        "samplingRate": 16000
                    }
                }
            ],
            "inputData": {
                "audio": [
                    {
                        "audioContent": base64_audio
                    }
                ]
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(callback_url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Bhashini ASR inference error {resp.status_code}: {resp.text}")
                raise RuntimeError(
                    f"Bhashini ASR inference failed ({resp.status_code}): {resp.text}"
                )

            data = resp.json()

        # Parse response
        # Standard format: pipelineResponse[0].output[0].source
        transcript = ""
        pipeline_resp = data.get("pipelineResponse", [])
        if pipeline_resp:
            output_items = pipeline_resp[0].get("output", [])
            if output_items:
                transcript = output_items[0].get("source", "")

        return {
            "transcript": transcript.strip(),
            "language": target_lang
        }


# Global singleton instance
bhashini_service = BhashiniService()
