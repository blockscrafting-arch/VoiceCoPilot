"""LLM provider for generating suggestions via OpenRouter."""

from openai import AsyncOpenAI

from ..config import settings
from ..logging_config import get_logger
from ..models.schemas import Message

logger = get_logger(__name__)

# System prompt for generating suggestions
SYSTEM_PROMPT = """Ты — ассистент для деловых созвонов. Твоя задача — помогать пользователю 
вести разговор с клиентами. На основе контекста разговора предлагай короткие, 
естественные фразы, которые пользователь может сказать дальше.

Правила:
1. Предлагай 2-3 варианта ответа.
2. Каждый вариант — 1-2 предложения максимум.
3. Будь профессиональным, но дружелюбным.
4. Если нужен технический ответ — дай краткую суть.
5. Отвечай на русском языке.

Формат ответа — только список фраз, по одной на строку, без нумерации и маркеров."""


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
        # Build conversation for LLM
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add context if provided
        if context:
            messages.append({
                "role": "user",
                "content": f"Контекст: {context}",
            })

        # Add conversation history (last 6 for lower latency)
        for msg in history[-6:]:
            role = "user" if msg.role == "user" else "assistant"
            messages.append({"role": role, "content": msg.text})

        # Add request for suggestions
        messages.append({
            "role": "user",
            "content": "Что мне ответить? Предложи варианты.",
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
        lines = response.strip().split("\n")
        suggestions = []

        for line in lines:
            # Clean up the line
            cleaned = line.strip()
            # Remove common prefixes like "1.", "- ", "* "
            if cleaned and cleaned[0].isdigit() and "." in cleaned[:3]:
                cleaned = cleaned.split(".", 1)[1].strip()
            elif cleaned.startswith(("-", "*", "•")):
                cleaned = cleaned[1:].strip()

            if cleaned:
                suggestions.append(cleaned)

        return suggestions[:5]  # Max 5 suggestions
