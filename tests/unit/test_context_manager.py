"""Unit tests for ContextManager."""

import sys
from pathlib import Path

# Add api source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "apps" / "api" / "src"))

from voicecopilot_api.services.context_manager import ContextManager


def test_context_manager_add_message():
    """Test adding a message to context."""
    ctx = ContextManager()
    ctx.add("user", "Привет")

    assert len(ctx.history) == 1
    assert ctx.history[0].role == "user"
    assert ctx.history[0].text == "Привет"


def test_context_manager_ignores_empty():
    """Test that empty messages are ignored."""
    ctx = ContextManager()
    ctx.add("user", "")
    ctx.add("user", "   ")

    assert len(ctx.history) == 0


def test_context_manager_get_recent():
    """Test getting recent messages."""
    ctx = ContextManager()
    for i in range(15):
        ctx.add("user", f"Message {i}")

    recent = ctx.get_recent(5)
    assert len(recent) == 5
    assert recent[0].text == "Message 10"
    assert recent[4].text == "Message 14"


def test_context_manager_clear():
    """Test clearing context."""
    ctx = ContextManager()
    ctx.add("user", "Test")
    ctx.clear()

    assert len(ctx.history) == 0
    assert ctx.summary is None


def test_context_manager_trim_history():
    """Test history trimming when exceeding max size."""
    ctx = ContextManager(max_history=30)

    # Add more messages than max
    for i in range(40):
        ctx.add("user", f"Message {i}")

    # Should keep last 20 and summarize rest
    assert len(ctx.history) == 20
    assert ctx.summary is not None


def test_context_manager_get_context_string():
    """Test formatting context as string."""
    ctx = ContextManager()
    ctx.add("user", "Привет")
    ctx.add("other", "Здравствуйте")

    context_str = ctx.get_context_string()

    assert "Последние реплики:" in context_str
    assert "Я: Привет" in context_str
    assert "Собеседник: Здравствуйте" in context_str
