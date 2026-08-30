"""ChromaDB vector store service with session-based collection isolation."""
import os
import time
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from app.config import settings

logger = logging.getLogger(__name__)

class VectorStoreService:
    """Manages document embeddings and session-namespaced collections in ChromaDB."""

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        
        # Initialize persistent Chroma client
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # Default local sentence transformer embedding function
        try:
            self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.EMBEDDING_MODEL_NAME
            )
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer embedding function ({e}), using default embedding.")
            self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()

    def _get_collection_name(self, session_id: str) -> str:
        """Sanitizes and formats collection name per session ID."""
        clean_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in session_id)
        # Chroma collection names must be 3-63 chars, start/end with alnum
        name = f"session_{clean_id}"
        if len(name) < 3:
            name = f"session_{clean_id}_db"
        return name[:63]

    def get_or_create_collection(self, session_id: str):
        """Retrieves or creates a ChromaDB collection for a session."""
        collection_name = self._get_collection_name(session_id)
        return self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn,
            metadata={"session_id": session_id}
        )

    def add_document_chunks(
        self,
        session_id: str,
        filename: str,
        chunks: List[str]
    ) -> int:
        """Stores document chunks into the session-isolated ChromaDB collection."""
        if not chunks:
            return 0
        
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
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        return len(chunks)

    def query_similar_chunks(
        self,
        session_id: str,
        query: str,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """Queries the session collection for chunks most relevant to the query."""
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
                
            n_results = min(top_k, count)
            results = collection.query(
                query_texts=[query],
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
            
            # Fetch sources from metadata
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
        """Deletes all documents for a specific session."""
        collection_name = self._get_collection_name(session_id)
        try:
            self.client.delete_collection(collection_name)
            return True
        except Exception:
            return False


# Singleton instance
vector_service = VectorStoreService()
