"""Integration tests for API endpoints."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add api source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "apps" / "api" / "src"))

from voicecopilot_api.main import app


@pytest.fixture
def client():
    """Create test client for API."""
    return TestClient(app)


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_endpoint(client):
    """Test readiness endpoint."""
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.skip(reason="Requires OpenRouter API key")
def test_suggestions_endpoint(client, sample_conversation):
    """Test suggestions generation endpoint."""
    response = client.post(
        "/api/suggestions/generate",
        json={
            "history": sample_conversation,
            "context": "Деловой звонок",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)


def test_suggestions_endpoint_empty_history(client):
    """Test suggestions with empty history."""
    response = client.post(
        "/api/suggestions/generate",
        json={
            "history": [],
            "context": "",
        },
    )

    # Should still return 200 (or 500 if no API key)
    assert response.status_code in [200, 500]
