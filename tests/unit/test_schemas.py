"""Unit tests for Pydantic schemas."""

import sys
from pathlib import Path

# Add api source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "apps" / "api" / "src"))

from voicecopilot_api.models.schemas import (
    Message,
    TranscriptionResult,
    SuggestionRequest,
    SuggestionResponse,
)


def test_message_creation():
    """Test Message schema creation."""
    msg = Message(role="user", text="Hello")

    assert msg.role == "user"
    assert msg.text == "Hello"


def test_transcription_result_defaults():
    """Test TranscriptionResult default values."""
    result = TranscriptionResult()

    assert result.text == ""
    assert result.is_final is False
    assert result.speaker == "user"


def test_transcription_result_with_values():
    """Test TranscriptionResult with provided values."""
    result = TranscriptionResult(
        text="Привет",
        is_final=True,
        speaker="other",
    )

    assert result.text == "Привет"
    assert result.is_final is True
    assert result.speaker == "other"


def test_suggestion_request():
    """Test SuggestionRequest schema."""
    request = SuggestionRequest(
        history=[
            Message(role="user", text="Hi"),
            Message(role="other", text="Hello"),
        ],
        context="Business call",
    )

    assert len(request.history) == 2
    assert request.context == "Business call"


def test_suggestion_response():
    """Test SuggestionResponse schema."""
    response = SuggestionResponse(
        suggestions=["Option 1", "Option 2", "Option 3"]
    )

    assert len(response.suggestions) == 3
    assert response.suggestions[0] == "Option 1"
