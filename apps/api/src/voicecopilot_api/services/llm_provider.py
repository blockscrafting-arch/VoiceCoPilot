"""LLM provider for generating one reply to the interlocutor via OpenRouter."""

from openai import AsyncOpenAI

from ..config import settings
from ..logging_config import get_logger
from ..models.schemas import Message

logger = get_logger(__name__)

# System prompt for generating one full reply
SYSTEM_PROMPT = """Ты помогаешь пользователю в деловых разговорах. В диалоге:
- «Вы» — это пользователь (тому, кому нужен ответ).
- «Собеседник» — клиент или партнёр.

Твоя задача: сформулировать один полноценный ответ пользователя (Вы) собеседнику на последнюю реплику. Длина ответа — оптимальная под вопрос: кратко по сути или развёрнуто, если нужно. Не предлагай варианты и не нумеруй. Только один готовый текст ответа от лица пользователя, без пояснений и преамбул. Только русский язык."""


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

    async def generate_reply(
        self,
        history: list[Message],
        context: str = "",
        model_override: str | None = None,
    ) -> str:
        """Generate one full reply from the user to the interlocutor.

        Args:
            history: Recent conversation messages.
            context: Additional context about the conversation.

        Returns:
            Single reply text (optimal length for the question).

        Raises:
            Exception: If both primary and fallback models fail.
        """
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
            "Собеседник только что сказал последнее сообщение. Напиши один готовый ответ пользователя (Вы) собеседнику. Только текст ответа, без пояснений."
        )
        messages.append({
            "role": "user",
            "content": "\n\n".join(user_content_parts),
        })

        primary_model = model_override or self._model

        try:
            response = await self._request_completion(messages, primary_model)
            return self._parse_reply(response)
        except Exception as e:
            logger.warning(
                "Primary model failed, trying fallback",
                model=primary_model,
                error=str(e),
            )

        try:
            response = await self._request_completion(messages, self._fallback_model)
            return self._parse_reply(response)
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
            max_tokens=500,
            temperature=0.7,
        )

        content = response.choices[0].message.content or ""
        logger.debug("LLM response received", length=len(content))
        return content

    def _parse_reply(self, response: str) -> str:
        """Parse one reply from LLM response (whole text or first paragraph)."""
        raw = response.strip()
        if not raw:
            return ""
        # Use first paragraph if model output multiple; otherwise whole text
        first_para = raw.split("\n\n")[0].strip()
        return first_para if first_para else raw
