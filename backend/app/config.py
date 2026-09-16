import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Backend root directory
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""
    
    # OpenRouter LLM Settings
    OPENROUTER_API_KEY: str = Field(default="", description="Single OpenRouter API Key for all models")
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1", description="OpenRouter API Base URL")
    
    # Google Gemini Settings (Direct API)
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API Key")
    GEMINI_BASE_URL: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta/openai/",
        description="Gemini OpenAI-compatible endpoint URL"
    )
    GEMINI_MODEL: str = Field(
        default="gemini-3.8-flash",
        description="Most powerful free model from Gemini"
    )
    GEMINI_MODEL_FALLBACK: str = Field(
        default="gemini-3.7-flash",
        description="Gemini fallback model"
    )
    
    # Text / RAG Models
    OPENROUTER_CHAT_MODEL: str = Field(
        default="inclusionai/ling-3.0-flash-fin:free",
        description="Primary chat / RAG model"
    )
    OPENROUTER_CHAT_MODEL_FALLBACK: str = Field(
        default="google/gemma-4-31b-it:free",
        description="Fallback chat model for rate limits or outages"
    )
    
    # Vision Model
    OPENROUTER_VISION_MODEL: str = Field(
        default="inclusionai/ling-3.0-flash-vl:free",
        description="Vision model supporting image analysis"
    )
    
    # Voice / TTS Model (Reserved)
    OPENROUTER_TTS_MODEL: str = Field(
        default="fish-audio/s2.1-pro-free:free",
        description="Voice output model"
    )
    
    # Frontend Model Selection Registry (Verified Active)
    OPENROUTER_MODEL_LING_3_FLASH: str = Field(default="inclusionai/ling-3.0-flash-fin:free")
    OPENROUTER_MODEL_CORTEX: str = Field(default="cohere/north-mini-code:free")
    OPENROUTER_MODEL_GEMMA_4_31B: str = Field(default="google/gemma-4-31b-it:free")
    OPENROUTER_MODEL_NEMOTRON_3_SUPER: str = Field(default="nvidia/nemotron-3-super-120b-a12b:free")
    OPENROUTER_MODEL_NEMOTRON_3_5_LIGHTNING: str = Field(default="nvidia/nemotron-3.5-lightning:free")
    OPENROUTER_MODEL_NEMOTRON_3_NANO_OMNI: str = Field(default="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")
    OPENROUTER_MODEL_LIQUID_LFM: str = Field(default="liquid/lfm-2.5-2.6b:free")
    OPENROUTER_MODEL_DOTS_3_NOTE: str = Field(default="dots-studio/dots-3-note-preview:free")
    
    # New OpenRouter Models
    NEX_N2_5_PRO_MODEL: str = Field(default="nex-agi/nex-n2.5-pro:free")
    LING_3_0_FLASH_VL_MODEL: str = Field(default="inclusionai/ling-3.0-flash-vl:free")
    OPENROUTER_MODEL_NEX_N2_5_PRO: str = Field(default="nex-agi/nex-n2.5-pro:free")
    OPENROUTER_MODEL_LING_3_FLASH_VL: str = Field(default="inclusionai/ling-3.0-flash-vl:free")
    
    # Web Search
    TAVILY_API_KEY: str = Field(default="", description="Optional Tavily Search API Key")
    
    # Vector DB & Storage
    CHROMA_PERSIST_DIR: str = Field(
        default=str(BACKEND_DIR / "data" / "vectorstore"),
        description="ChromaDB local persistence directory"
    )
    
    # CORS & Server
    FRONTEND_ORIGIN: str = Field(default="http://localhost:5173", description="Frontend allowed origin")
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    
    # OpenRouter Remote Embeddings (Zero local model / zero torch)
    OPENROUTER_EMBEDDING_MODEL: str = Field(
        default="openai/text-embedding-3-small",
        description="Remote OpenRouter embeddings model"
    )
    OPENROUTER_EMBEDDING_BATCH_SIZE: int = Field(
        default=32,
        description="Max chunks per batch sent to OpenRouter Embeddings API"
    )

    # Bhashini Voice I/O Settings (TTS & STT)
    BHASHINI_USER_ID: str = Field(default="", description="Optional Bhashini / ULCA User ID")
    BHASHINI_INFERENCE_API_KEY: str = Field(default="", description="Bhashini Inference API Key")
    BHASHINI_API_KEY: str = Field(default="", description="General Bhashini API Key")
    BHASHINI_ULCA_API_KEY: str = Field(default="", description="Bhashini / ULCA API Key")
    BHASHINI_PIPELINE_ID: str = Field(
        default="64392f96daac500b55c543cd",
        description="Bhashini Pipeline ID"
    )
    BHASHINI_ASR_SERVICE_ID: str = Field(
        default="bhashini/iitm/asr-dravidian--gpu--t4",
        description="Bhashini ASR Service ID (default Dravidian: ta, te, kn, ml)"
    )
    BHASHINI_TTS_SERVICE_ID: str = Field(
        default="Bhashini/IITM/TTS",
        description="Bhashini TTS Service ID (IIT Madras multilingual TTS)"
    )
    BHASHINI_CONFIG_ENDPOINT: str = Field(
        default="https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline",
        description="Bhashini Pipeline Config URL"
    )
    BHASHINI_INFERENCE_ENDPOINT: str = Field(
        default="https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
        description="Bhashini Inference Pipeline URL"
    )


    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env") if (BACKEND_DIR / ".env").is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
