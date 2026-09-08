"""Automated tests for OpenRouter remote embeddings and RAG pipeline."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.vector_service import vector_service
from app.core.security import check_emergency_indicators


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check_endpoint(client):
    """Test /health returns healthy status and reports OpenRouter embedding model."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["embedding_model"] == "openai/text-embedding-3-small"
    assert data["vectorstore"] == "ready"


def test_root_endpoint(client):
    """Test root / endpoint returns 200 OK for platform health pingers."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"


def test_emergency_indicators():
    """Test clinical emergency detection protocol."""
    assert check_emergency_indicators("I am experiencing crushing chest pain and shortness of breath") is True
    assert check_emergency_indicators("Can you recommend foods high in iron?") is False


def test_openrouter_single_embedding():
    """Test remote embedding generation for single query."""
    vector = embedding_service.embed_text_sync("Cardiovascular clinical trial")
    assert isinstance(vector, list)
    assert len(vector) == 1536
    assert all(isinstance(x, float) for x in vector[:10])


def test_openrouter_batch_embeddings():
    """Test remote batch embedding generation with order preservation."""
    texts = [
        "First clinical chunk about asthma.",
        "Second clinical chunk about inhaler dosage.",
        "Third clinical chunk about follow-up visit."
    ]
    vectors = embedding_service.embed_documents_sync(texts)
    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 1536


def test_chromadb_rag_lifecycle():
    """Test document chunking, indexing, and similarity search in ChromaDB."""
    test_session = "test_pytest_session_001"
    chunks = [
        "Patient was diagnosed with Type 2 Diabetes Mellitus in 2021.",
        "Current daily regimen: Metformin 850mg twice daily with meals.",
        "Patient reports mild gastrointestinal side effects initially, now resolved."
    ]

    # 1. Index document chunks
    stored = vector_service.add_document_chunks(test_session, "diabetes_notes.txt", chunks)
    assert stored == 3

    # 2. Query similar chunks
    results = vector_service.query_similar_chunks(
        test_session,
        "What dosage of Metformin does the patient take?",
        top_k=2
    )
    assert len(results) > 0
    assert "Metformin 850mg" in results[0]["content"]

    # 3. Check stats
    stats = vector_service.get_session_stats(test_session)
    assert stats["chunk_count"] == 3
    assert "diabetes_notes.txt" in stats["sources"]

    # 4. Clean up
    cleared = vector_service.clear_session_documents(test_session)
    assert cleared is True
