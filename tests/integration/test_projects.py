"""Integration tests for project management."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "apps" / "api" / "src"))

from voicecopilot_api.main import app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Create test client with isolated working directory."""
    monkeypatch.chdir(tmp_path)
    return TestClient(app)


def test_project_lifecycle(client: TestClient, tmp_path: Path) -> None:
    """Create, update, and fetch a project."""
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert response.json()["projects"] == []

    response = client.post("/api/projects", json={"name": "Demo"})
    assert response.status_code == 200
    project = response.json()
    assert project["name"] == "Demo"
    assert project["llm_model"]

    project_id = project["id"]
    response = client.patch(
        f"/api/projects/{project_id}",
        json={"context_text": "Контекст", "llm_model": "google/gemini-2.5-flash"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["context_text"] == "Контекст"
    assert updated["llm_model"] == "google/gemini-2.5-flash"

    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    fetched = response.json()
    assert fetched["id"] == project_id

    projects_dir = tmp_path / "projects" / project_id
    assert (projects_dir / "context.json").exists()


def test_context_file_upload(client: TestClient, tmp_path: Path) -> None:
    """Upload a text context file and append to project context."""
    response = client.post("/api/projects", json={"name": "Files"})
    project_id = response.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/context/files",
        data={"mode": "append"},
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 200
    project = response.json()
    assert "hello world" in project["context_text"]
    assert "notes.txt" in project["files"]

    file_path = tmp_path / "projects" / project_id / "context_files" / "notes.txt"
    assert file_path.exists()
