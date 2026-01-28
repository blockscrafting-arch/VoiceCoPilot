"""Pytest configuration and shared fixtures."""

import pytest
from typing import Generator


@pytest.fixture
def sample_audio_data() -> bytes:
    """Generate sample audio data for testing.

    Returns:
        Bytes representing 1 second of silence at 16kHz 16-bit mono.
    """
    # 16kHz * 2 bytes per sample * 1 second = 32000 bytes
    return b"\x00" * 32000


@pytest.fixture
def sample_conversation() -> list[dict]:
    """Generate sample conversation history.

    Returns:
        List of message dictionaries.
    """
    return [
        {"role": "other", "text": "Здравствуйте! Расскажите о ваших услугах."},
        {"role": "user", "text": "Добрый день! Я занимаюсь автоматизацией процессов."},
        {"role": "other", "text": "Интересно. А какие инструменты вы используете?"},
    ]
