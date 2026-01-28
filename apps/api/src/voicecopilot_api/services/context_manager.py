"""Context manager for maintaining conversation state."""

from dataclasses import dataclass, field
from typing import Optional

from ..logging_config import get_logger
from ..models.schemas import Message

logger = get_logger(__name__)


@dataclass
class ContextManager:
    """Manages conversation context and history.

    Keeps track of recent messages and provides summarization
    for efficient context handling with LLM.

    Attributes:
        history: List of conversation messages.
        max_history: Maximum number of messages to keep.
        summary: Optional summary of older conversation.
    """

    history: list[Message] = field(default_factory=list)
    max_history: int = 50
    summary: Optional[str] = None

    def add(self, role: str, text: str) -> None:
        """Add a new message to the conversation history.

        Args:
            role: Speaker role (user or other).
            text: Message content.
        """
        if not text.strip():
            return

        message = Message(role=role, text=text.strip())
        self.history.append(message)
        logger.debug("Message added to context", role=role, length=len(text))

        # Trim history if too long
        keep_count = min(20, self.max_history)
        if len(self.history) > self.max_history or (
            self.summary is not None and len(self.history) > keep_count
        ):
            self._trim_history()

    def get_recent(self, count: int = 10) -> list[Message]:
        """Get the most recent messages.

        Args:
            count: Number of messages to retrieve.

        Returns:
            List of recent messages.
        """
        return self.history[-count:]

    def get_context_string(self) -> str:
        """Get formatted context string for LLM.

        Returns:
            Formatted string with summary and recent messages.
        """
        parts = []

        if self.summary:
            parts.append(f"Резюме предыдущего разговора: {self.summary}")

        recent = self.get_recent(10)
        if recent:
            parts.append("Последние реплики:")
            for msg in recent:
                speaker = "Я" if msg.role == "user" else "Собеседник"
                parts.append(f"{speaker}: {msg.text}")

        return "\n".join(parts)

    def _trim_history(self) -> None:
        """Trim history by summarizing older messages.

        Keeps the most recent messages and summarizes the rest.
        """
        # Keep last messages up to the configured cap, summarize the rest
        keep_count = min(20, self.max_history)
        if len(self.history) <= keep_count:
            return

        old_messages = self.history[:-keep_count]
        self.history = self.history[-keep_count:]

        # Simple summary: just note how many messages were summarized
        # TODO: Use LLM for actual summarization
        topics = set()
        for msg in old_messages:
            # Extract potential topics (simplified)
            words = msg.text.lower().split()
            topics.update(w for w in words if len(w) > 5)

        self.summary = f"Обсуждались темы: {', '.join(list(topics)[:10])}"
        logger.info("History trimmed", old_count=len(old_messages), summary=self.summary)

    def clear(self) -> None:
        """Clear all conversation history."""
        self.history.clear()
        self.summary = None
        logger.info("Context cleared")
