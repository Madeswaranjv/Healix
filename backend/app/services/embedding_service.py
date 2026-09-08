"""OpenRouter Remote Embeddings Service for Healix.

Uses remote OpenAI-compatible embeddings via OpenRouter (openai/text-embedding-3-small).
Zero local model inference, minimal memory footprint.
"""
import asyncio
import logging
from typing import List, Optional
import httpx
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

from app.config import settings

logger = logging.getLogger("healix.embeddings")


class EmbeddingServiceError(RuntimeError):
    """Clean domain exception for embedding failures. Never leaks API keys."""
    pass


class EmbeddingService:
    """Manages remote text embeddings via OpenRouter's OpenAI-compatible API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        batch_size: Optional[int] = None,
        timeout: float = 30.0,
    ):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.base_url = (base_url or settings.OPENROUTER_BASE_URL).rstrip("/")
        self.model = model or getattr(settings, "OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small")
        self.batch_size = max(1, batch_size or getattr(settings, "OPENROUTER_EMBEDDING_BATCH_SIZE", 32))
        self.timeout = timeout
        self.endpoint = f"{self.base_url}/embeddings"

    def _get_headers(self) -> dict:
        key = (self.api_key or settings.OPENROUTER_API_KEY).strip()
        if not key:
            raise EmbeddingServiceError(
                "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY."
            )
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://healix.app",
            "X-Title": "Healix Healthcare AI",
        }

    async def embed_text(self, text: str) -> List[float]:
        """Generates an embedding vector for a single string query or passage."""
        clean_text = text.strip() if text else ""
        if not clean_text:
            raise EmbeddingServiceError("Cannot embed empty text.")

        results = await self.embed_documents([clean_text])
        if not results:
            raise EmbeddingServiceError("Failed to generate embedding for query.")
        return results[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings for multiple document chunks with batching and memory management."""
        if not texts:
            return []

        # Sanitize texts — replace empty with single space
        sanitized = [t if (t and t.strip()) else " " for t in texts]
        all_embeddings: List[List[float]] = []

        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Process in conservative batches to conserve memory
            for i in range(0, len(sanitized), self.batch_size):
                batch = sanitized[i : i + self.batch_size]
                payload = {
                    "model": self.model,
                    "input": batch,
                }

                try:
                    res = await client.post(self.endpoint, headers=headers, json=payload)
                    res.raise_for_status()
                    data = res.json()
                except httpx.TimeoutException:
                    logger.error(f"[EmbeddingService] Request timed out ({self.timeout}s) on batch {i // self.batch_size + 1}")
                    raise EmbeddingServiceError(
                        f"OpenRouter embedding request timed out after {self.timeout}s."
                    )
                except httpx.HTTPStatusError as e:
                    status_code = e.response.status_code
                    logger.error(f"[EmbeddingService] HTTP error {status_code} on batch {i // self.batch_size + 1}")
                    if status_code in (401, 403):
                        raise EmbeddingServiceError(
                            "OpenRouter authentication failed. Please check your OPENROUTER_API_KEY."
                        )
                    elif status_code == 429:
                        raise EmbeddingServiceError(
                            "OpenRouter rate limit exceeded during embedding generation. Please retry shortly."
                        )
                    else:
                        raise EmbeddingServiceError(
                            f"OpenRouter embedding service returned HTTP error {status_code}."
                        )
                except httpx.RequestError as e:
                    logger.error(f"[EmbeddingService] Network connection failure: {type(e).__name__}")
                    raise EmbeddingServiceError(
                        "Network error connecting to OpenRouter embedding service."
                    )
                except Exception as e:
                    logger.error(f"[EmbeddingService] Unexpected response parsing error: {e}")
                    raise EmbeddingServiceError("Failed to parse OpenRouter embedding response.")

                items = data.get("data", [])
                if not items or len(items) != len(batch):
                    raise EmbeddingServiceError(
                        f"Mismatched embedding response: received {len(items)} embeddings for {len(batch)} inputs."
                    )

                # Ensure embeddings maintain original input order
                sorted_items = sorted(items, key=lambda x: x.get("index", 0))
                for item in sorted_items:
                    embedding = item.get("embedding")
                    if not embedding or not isinstance(embedding, list):
                        raise EmbeddingServiceError("Malformed embedding vector received from OpenRouter.")
                    all_embeddings.append(embedding)

                # Explicitly discard batch payload to free memory immediately
                del payload
                del data

        return all_embeddings

    def embed_text_sync(self, text: str) -> List[float]:
        """Synchronous wrapper for embedding a single text string."""
        clean_text = text.strip() if text else ""
        if not clean_text:
            raise EmbeddingServiceError("Cannot embed empty text.")
        res = self.embed_documents_sync([clean_text])
        return res[0]

    def embed_documents_sync(self, texts: List[str]) -> List[List[float]]:
        """Synchronous wrapper for embedding multiple document chunks using httpx.Client."""
        if not texts:
            return []

        sanitized = [t if (t and t.strip()) else " " for t in texts]
        all_embeddings: List[List[float]] = []
        headers = self._get_headers()

        with httpx.Client(timeout=self.timeout) as client:
            for i in range(0, len(sanitized), self.batch_size):
                batch = sanitized[i : i + self.batch_size]
                payload = {
                    "model": self.model,
                    "input": batch,
                }

                try:
                    res = client.post(self.endpoint, headers=headers, json=payload)
                    res.raise_for_status()
                    data = res.json()
                except httpx.TimeoutException:
                    logger.error(f"[EmbeddingService] Sync request timed out ({self.timeout}s)")
                    raise EmbeddingServiceError(
                        f"OpenRouter embedding request timed out after {self.timeout}s."
                    )
                except httpx.HTTPStatusError as e:
                    status_code = e.response.status_code
                    if status_code in (401, 403):
                        raise EmbeddingServiceError(
                            "OpenRouter authentication failed. Please check your OPENROUTER_API_KEY."
                        )
                    elif status_code == 429:
                        raise EmbeddingServiceError(
                            "OpenRouter rate limit exceeded during embedding generation. Please retry shortly."
                        )
                    else:
                        raise EmbeddingServiceError(
                            f"OpenRouter embedding service returned HTTP error {status_code}."
                        )
                except httpx.RequestError:
                    raise EmbeddingServiceError(
                        "Network error connecting to OpenRouter embedding service."
                    )
                except Exception as e:
                    raise EmbeddingServiceError(f"Failed to parse OpenRouter embedding response: {e}")

                items = data.get("data", [])
                sorted_items = sorted(items, key=lambda x: x.get("index", 0))
                for item in sorted_items:
                    embedding = item.get("embedding")
                    all_embeddings.append(embedding)

                del payload
                del data

        return all_embeddings


class OpenRouterChromaEmbeddingFunction(EmbeddingFunction[Documents]):
    """ChromaDB compatible embedding function adapter backed by OpenRouter."""

    def __init__(self, service: Optional[EmbeddingService] = None):
        self.service = service or embedding_service

    def name(self) -> str:
        return "openrouter_text_embedding_3_small"

    def __call__(self, input: Documents) -> Embeddings:
        """Called synchronously by ChromaDB when documents or queries are passed directly."""
        return self.service.embed_documents_sync(list(input))


# Singleton instance
embedding_service = EmbeddingService()
openrouter_chroma_ef = OpenRouterChromaEmbeddingFunction(embedding_service)
