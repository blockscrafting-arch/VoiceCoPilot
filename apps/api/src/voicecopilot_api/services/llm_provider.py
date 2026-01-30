"""LLM provider for generating suggestions via OpenRouter."""

import json
import re

from openai import AsyncOpenAI

from ..config import settings
from ..logging_config import get_logger
from ..models.schemas import Message

logger = get_logger(__name__)

# System prompt for generating suggestions
SYSTEM_PROMPT = """Ты помогаешь пользователю в деловых разговорах. В диалоге:
- «Вы» — это пользователь (тот, кому нужны подсказки).
- «Собеседник» — клиент или партнёр.

Твоя задача: предлагать только фразы, которые может сказать пользователь (Вы), в ответ на реплику собеседника. Не предлагай реплики от лица собеседника.

Правила:
1. 2–3 варианта ответа, по одной фразе на строку.
2. Каждый вариант — 1–2 предложения максимум, от лица пользователя.
3. Профессионально и по теме последней реплики собеседника.
4. Только русский язык.
5. Формат ответа: только текст фраз, по одной на строку, без нумерации, маркеров и пояснений."""


class LLMProvider:
    """Provider for LLM-based suggestion generation.

    Uses OpenRouter API with OpenAI-compatible client.

    Attributes:
        client: Async OpenAI client configured for OpenRouter.
        model: Current model identifier.
    """

    def __init__(self) -> None:
        """Initialize the LLM provider with OpenRouter configuration."""
        self._client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
            timeout=30.0,
            max_retries=2,
        )
        self._model = settings.llm_model
        self._fallback_model = settings.llm_fallback_model

    async def generate_suggestions(
        self,
        history: list[Message],
        context: str = "",
        model_override: str | None = None,
    ) -> list[str]:
        """Generate conversation suggestions based on history.

        Args:
            history: Recent conversation messages.
            context: Additional context about the conversation.

        Returns:
            List of suggested responses.

        Raises:
            Exception: If both primary and fallback models fail.
        """
        # Build dialogue as explicit "Собеседник:" / "Вы:" so the model keeps roles clear
        dialogue_lines = []
        for msg in history[-6:]:
            if msg.role == "user":
                dialogue_lines.append(f"Вы: {msg.text}")
            else:
                dialogue_lines.append(f"Собеседник: {msg.text}")
        dialogue = "\n".join(dialogue_lines)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        user_content_parts = []
        if context:
            user_content_parts.append(f"Контекст: {context}")
        user_content_parts.append("Вот диалог:")
        user_content_parts.append(dialogue)
        user_content_parts.append(
            "Собеседник только что сказал последнее сообщение. Что может ответить пользователь (Вы)? Дай 2–3 короткие фразы, по одной на строку, без нумерации."
        )
        messages.append({
            "role": "user",
            "content": "\n\n".join(user_content_parts),
        })

        primary_model = model_override or self._model

        # Try primary model first
        try:
            response = await self._request_completion(messages, primary_model)
            return self._parse_suggestions(response)
        except Exception as e:
            logger.warning(
                "Primary model failed, trying fallback",
                model=primary_model,
                error=str(e),
            )

        # Try fallback model
        try:
            response = await self._request_completion(messages, self._fallback_model)
            return self._parse_suggestions(response)
        except Exception as e:
            logger.exception("Fallback model also failed", error=str(e))
            raise

    async def _request_completion(self, messages: list[dict], model: str) -> str:
        """Request completion from the LLM.

        Args:
            messages: List of message dictionaries.
            model: Model identifier.

        Returns:
            Response text from the model.
        """
        logger.debug("Requesting LLM completion", model=model)

        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore
            max_tokens=300,
            temperature=0.7,
        )

        content = response.choices[0].message.content or ""
        logger.debug("LLM response received", length=len(content))
        return content

    def _parse_suggestions(self, response: str) -> list[str]:
        """Parse suggestions from LLM response.

        Args:
            response: Raw response text from LLM.

        Returns:
            List of individual suggestions.
        """
        raw = response.strip()
        suggestions: list[str] = []

        # Try JSON array (e.g. ["фраза 1", "фраза 2"])
        json_match = re.search(r"\[[\s\S]*?\]", raw)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                if isinstance(parsed, list):
                    for x in parsed:
                        if isinstance(x, str) and x.strip():
                            suggestions.append(x.strip())
                    if suggestions:
                        return suggestions[:5]
            except Exception:
                pass

        # Line-by-line: strip numbering, markers, take non-empty
        for line in raw.split("\n"):
            cleaned = line.strip()
            if not cleaned:
                continue
            # Remove "1.", "1)", "- ", "* ", "• ", "— "
            cleaned = re.sub(r"^\s*\d+[.)]\s*", "", cleaned)
            cleaned = re.sub(r"^\s*[-*•—]\s*", "", cleaned)
            cleaned = cleaned.strip()
            if cleaned and len(cleaned) > 1:
                suggestions.append(cleaned)

        return suggestions[:5]  # Max 5 suggestions
