"""ChromaDB vector store service with session-based collection isolation and OpenRouter remote embeddings.

Uses OpenAI-compatible text-embedding-3-small via OpenRouter.
Zero local models, zero PyTorch/CUDA dependencies.
"""
import os
import time
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.services.embedding_service import embedding_service, openrouter_chroma_ef, EmbeddingServiceError

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Manages document embeddings and session-namespaced collections in ChromaDB using OpenRouter."""

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_dir, exist_ok=True)

        # Initialize persistent Chroma client
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.embedding_fn = openrouter_chroma_ef

    def _get_collection_name(self, session_id: str) -> str:
        """Sanitizes and formats collection name per session ID for v2 OpenRouter embeddings."""
        clean_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in session_id)
        # Suffix with _v2 to ensure complete isolation from legacy 384-dim MiniLM vectors
        name = f"session_{clean_id}_v2"
        if len(name) < 3:
            name = f"session_{clean_id}_v2_db"
        return name[:63]

    def _get_legacy_collection_name(self, session_id: str) -> str:
        """Returns the legacy collection name from previous local MiniLM model."""
        clean_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in session_id)
        name = f"session_{clean_id}"
        if len(name) < 3:
            name = f"session_{clean_id}_db"
        return name[:63]

    def get_or_create_collection(self, session_id: str):
        """Retrieves or creates a ChromaDB collection for a session using OpenRouter embeddings."""
        collection_name = self._get_collection_name(session_id)

        # Clean up legacy incompatible 384-dim collection if present
        legacy_name = self._get_legacy_collection_name(session_id)
        try:
            existing = [c.name for c in self.client.list_collections()]
            if legacy_name in existing and legacy_name != collection_name:
                logger.info(f"Purging legacy incompatible 384-dim collection: {legacy_name}")
                self.client.delete_collection(legacy_name)
        except Exception as e:
            logger.debug(f"Legacy collection cleanup notice: {e}")

        return self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn,
            metadata={
                "session_id": session_id,
                "embedding_model": getattr(settings, "OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
                "version": "v2"
            }
        )

    def add_document_chunks(
        self,
        session_id: str,
        filename: str,
        chunks: List[str]
    ) -> int:
        """Embeds document chunks via OpenRouter and stores them into the session collection."""
        if not chunks:
            return 0

        # Generate remote embeddings via OpenRouter
        logger.info(f"Generating OpenRouter embeddings for {len(chunks)} chunks of '{filename}'...")
        embeddings = embedding_service.embed_documents_sync(chunks)

        collection = self.get_or_create_collection(session_id)
        ts = int(time.time())

        ids = [f"{filename}_{ts}_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "session_id": session_id,
                "source": filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "timestamp": ts
            }
            for i in range(len(chunks))
        ]

        collection.add(
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        logger.info(f"Successfully stored {len(chunks)} embedded chunks into ChromaDB.")
        return len(chunks)

    def query_similar_chunks(
        self,
        session_id: str,
        query: str,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """Embeds query via OpenRouter and retrieves most relevant document chunks."""
        collection_name = self._get_collection_name(session_id)
        try:
            collections = [c.name for c in self.client.list_collections()]
            if collection_name not in collections:
                return []

            collection = self.client.get_collection(
                name=collection_name,
                embedding_function=self.embedding_fn
            )

            count = collection.count()
            if count == 0:
                return []

            # Generate query embedding vector via OpenRouter
            query_vector = embedding_service.embed_text_sync(query)

            n_results = min(top_k, count)
            results = collection.query(
                query_embeddings=[query_vector],
                n_results=n_results
            )

            retrieved = []
            if results and "documents" in results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
                distances = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

                for doc, meta, dist in zip(docs, metas, distances):
                    retrieved.append({
                        "content": doc,
                        "metadata": meta,
                        "score": dist
                    })
            return retrieved

        except Exception as e:
            logger.error(f"Error querying vector store for session {session_id}: {e}")
            return []

    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """Gets stats about documents stored for a session."""
        collection_name = self._get_collection_name(session_id)
        try:
            collections = [c.name for c in self.client.list_collections()]
            if collection_name not in collections:
                return {"chunk_count": 0, "sources": []}

            collection = self.client.get_collection(
                name=collection_name,
                embedding_function=self.embedding_fn
            )
            count = collection.count()

            peek_data = collection.get(include=["metadatas"])
            sources = set()
            if peek_data and "metadatas" in peek_data and peek_data["metadatas"]:
                for m in peek_data["metadatas"]:
                    if m and "source" in m:
                        sources.add(m["source"])

            return {
                "chunk_count": count,
                "sources": list(sources)
            }
        except Exception as e:
            logger.error(f"Error getting session stats for {session_id}: {e}")
            return {"chunk_count": 0, "sources": []}

    def clear_session_documents(self, session_id: str) -> bool:
        """Deletes both v2 and any legacy documents for a specific session."""
        collection_name = self._get_collection_name(session_id)
        legacy_name = self._get_legacy_collection_name(session_id)
        cleared = False

        for name in (collection_name, legacy_name):
            try:
                self.client.delete_collection(name)
                cleared = True
            except Exception:
                pass
        return cleared


# Singleton instance
vector_service = VectorStoreService()
