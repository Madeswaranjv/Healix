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
    
    # Text / RAG Models
    OPENROUTER_CHAT_MODEL: str = Field(
        default="inclusionai/ling-3.0-flash-fin:free",
        description="Primary chat / RAG model"
    )
    OPENROUTER_CHAT_MODEL_FALLBACK: str = Field(
        default="minimax/minimax-m3:free",
        description="Fallback chat model for rate limits or outages"
    )
    
    # Vision Model
    OPENROUTER_VISION_MODEL: str = Field(
        default="minimax/minimax-m3:free",
        description="Vision model supporting image analysis"
    )
    
    # Voice / TTS Model (Reserved)
    OPENROUTER_TTS_MODEL: str = Field(
        default="fish-audio/s2.1-pro-free:free",
        description="Voice output model"
    )
    
    # Frontend Model Selection Registry (Verified Active)
    OPENROUTER_MODEL_LING_3_FLASH: str = Field(default="inclusionai/ling-3.0-flash-fin:free")
    OPENROUTER_MODEL_MINIMAX_M3: str = Field(default="minimax/minimax-m3:free")
    OPENROUTER_MODEL_MINIMAX_M2_7: str = Field(default="minimax/minimax-m2.7:free")
    OPENROUTER_MODEL_GEMMA_4_31B: str = Field(default="google/gemma-4-31b-it:free")
    OPENROUTER_MODEL_NEMOTRON_3_SUPER: str = Field(default="nvidia/nemotron-3-super-120b-a12b:free")
    OPENROUTER_MODEL_NEMOTRON_3_5_LIGHTNING: str = Field(default="nvidia/nemotron-3.5-lightning:free")
    OPENROUTER_MODEL_NEMOTRON_3_NANO_OMNI: str = Field(default="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")
    OPENROUTER_MODEL_LIQUID_LFM: str = Field(default="liquid/lfm-2.5-2.6b:free")
    OPENROUTER_MODEL_DOTS_3_NOTE: str = Field(default="dots-studio/dots-3-note-preview:free")
    
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
    
    # Embedding model name
    EMBEDDING_MODEL_NAME: str = Field(
        default="all-MiniLM-L6-v2",
        description="Sentence transformers embedding model"
    )

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
