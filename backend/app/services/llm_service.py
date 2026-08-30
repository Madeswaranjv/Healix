"""OpenRouter LLM integration service with automatic model fallbacks and vision support."""
import base64
import logging
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI

from app.config import settings
from app.core.prompts import VISION_ANALYSIS_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

class LLMService:
    """Handles communication with OpenRouter's OpenAI-compatible API."""

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.primary_model = settings.OPENROUTER_CHAT_MODEL
        self.fallback_model = settings.OPENROUTER_CHAT_MODEL_FALLBACK
        self.vision_model = settings.OPENROUTER_VISION_MODEL
        
        self.client = AsyncOpenAI(
            api_key=self.api_key or "sk-dummy-key",
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "https://healix.app",
                "X-Title": "Healix Healthcare Chatbot",
            }
        )

    # Friendly name to OpenRouter model mapping (Verified Active & Operational)
    MODEL_MAP = {
        "Ling 3.0 Flash": "inclusionai/ling-3.0-flash-fin:free",
        "Ling 3.0": "inclusionai/ling-3.0-flash-fin:free",
        "MiniMax M3": "minimax/minimax-m3:free",
        "MiniMax M2.7": "minimax/minimax-m2.7:free",
        "MiniMax": "minimax/minimax-m3:free",
        "Gemma 4 31B": "google/gemma-4-31b-it:free",
        "Gemma 4": "google/gemma-4-31b-it:free",
        "Nemotron 3 Super": "nvidia/nemotron-3-super-120b-a12b:free",
        "Nemotron 3.5 Lightning": "nvidia/nemotron-3.5-lightning:free",
        "Nemotron 3 Nano Omni": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "Nemotron 3": "nvidia/nemotron-3-super-120b-a12b:free",
        "Liquid LFM": "liquid/lfm-2.5-2.6b:free",
        "Dots 3 Note": "dots-studio/dots-3-note-preview:free",
    }

    def resolve_model(self, model_name: Optional[str]) -> str:
        """Resolves a model name or ID to an OpenRouter model ID."""
        if not model_name:
            return self.primary_model
        # If it's in our mapping, use mapped ID
        if model_name in self.MODEL_MAP:
            return self.MODEL_MAP[model_name]
        # Otherwise, if it's already an OpenRouter format (e.g. contains '/'), use as is
        if "/" in model_name:
            return model_name
        return self.primary_model

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500
    ) -> str:
        """Generates a chat completion with automatic fallback to secondary model."""
        if not self.api_key:
            return (
                "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                "Please add `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
            )

        target_model = self.resolve_model(model)

        # Attempt target/primary model
        try:
            logger.info(f"Querying chat model: {target_model}")
            response = await self.client.chat.completions.create(
                model=target_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            if response.choices and response.choices[0].message.content:
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Target model {target_model} failed ({e}). Attempting fallback {self.fallback_model}...")

        # Attempt fallback model if different from target
        if target_model != self.fallback_model:
            try:
                logger.info(f"Querying fallback chat model: {self.fallback_model}")
                response = await self.client.chat.completions.create(
                    model=self.fallback_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                if response.choices and response.choices[0].message.content:
                    return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"Fallback model {self.fallback_model} also failed: {e}")

        return "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please verify your API key / model availability or try again in a moment."

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500
    ):
        """Yields streaming delta text chunks from OpenRouter with fallback support."""
        if not self.api_key:
            yield (
                "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                "Please add `OPENROUTER_API_KEY` to enable real-time healthcare AI responses."
            )
            return

        target_model = self.resolve_model(model)

        # Attempt streaming from target model
        try:
            logger.info(f"Streaming from chat model: {target_model}")
            response = await self.client.chat.completions.create(
                model=target_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
            return
        except Exception as e:
            logger.warning(f"Target model {target_model} streaming failed ({e}). Attempting fallback {self.fallback_model}...")

        # Attempt fallback model
        if target_model != self.fallback_model:
            try:
                logger.info(f"Streaming from fallback chat model: {self.fallback_model}")
                response = await self.client.chat.completions.create(
                    model=self.fallback_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
                async for chunk in response:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                logger.error(f"Fallback model {self.fallback_model} streaming also failed: {e}")

        yield "I apologize, but I am currently experiencing connection difficulties with our AI inference provider. Please try again in a moment."

    async def analyze_image(

        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        question: str = "Please inspect and describe the visible details in this healthcare image."
    ) -> str:
        """Performs visual analysis on medical images or lab sheets using vision LLMs."""
        if not self.api_key:
            return (
                "**Notice:** OpenRouter API key is not configured in backend `.env`. "
                "Please add `OPENROUTER_API_KEY` to enable vision analysis."
            )

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_image}"

        messages = [
            {"role": "system", "content": VISION_ANALYSIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question or "Please analyze this healthcare image."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]

        # Try vision model
        try:
            logger.info(f"Querying vision model: {self.vision_model}")
            response = await self.client.chat.completions.create(
                model=self.vision_model,
                messages=messages,
                max_tokens=1200
            )
            if response.choices and response.choices[0].message.content:
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Vision model {self.vision_model} failed ({e}). Attempting fallback vision models...")
            
            # Fallback to secondary vision models
            fallback_vision_models = ["minimax/minimax-m2.7:free", "google/gemma-4-31b-it:free"]
            for f_model in fallback_vision_models:
                try:
                    logger.info(f"Attempting fallback vision model: {f_model}")
                    response = await self.client.chat.completions.create(
                        model=f_model,
                        messages=messages,
                        max_tokens=1200
                    )
                    if response.choices and response.choices[0].message.content:
                        return response.choices[0].message.content.strip()
                except Exception as fb_err:
                    logger.warning(f"Fallback vision model {f_model} failed: {fb_err}")

        return (
            "Unable to analyze the image at this moment due to provider rate limits or image processing constraints. "
            "Please ensure the image is clear and try again."
        )

# Singleton instance
llm_service = LLMService()
