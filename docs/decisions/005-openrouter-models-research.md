# Ресерч: актуальные модели OpenRouter для селектора в UI

**Дата:** 2026-01-30

## Источники

- [OpenRouter Models](https://openrouter.ai/models) — каталог моделей
- [API: List models](https://openrouter.ai/docs/api-reference/list-available-models) — `GET https://openrouter.ai/api/v1/models` (возвращает полный список; для запроса может требоваться API key)
- Поиск по документации и страницам моделей OpenRouter

## Формат ID

Модели задаются как `provider/model-name`, например: `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`.

## Актуальные модели (на январь 2026)

### Google Gemini

| ID | Описание | Примечание |
|----|----------|------------|
| `google/gemini-2.0-flash-exp:free` | Gemini 2.0 Flash (free) | Бесплатный вариант, экспериментальный; депрекация ~март 2026 |
| `google/gemini-2.0-flash-001` | Gemini 2.0 Flash | Платный; уход ~31 марта 2026 |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash | Текущая быстрая модель с «thinking» |
| `google/gemini-2.5-pro` | Gemini 2.5 Pro | Более мощная модель, лидер по бенчмаркам |
| `google/gemini-3-flash-preview` | Gemini 3 Flash (preview) | Быстрое рассуждение, агентные сценарии |

### Anthropic Claude

| ID | Описание |
|----|----------|
| `anthropic/claude-3.5-sonnet` | Claude 3.5 Sonnet |
| `anthropic/claude-sonnet-4` | Claude Sonnet 4 |
| `anthropic/claude-sonnet-4.5` | Claude Sonnet 4.5 (агентные сценарии, инструменты) |

### OpenAI

| ID | Описание |
|----|----------|
| `openai/gpt-4o` | GPT-4o |
| `openai/gpt-4o-mini` | GPT-4o Mini (дешевле и быстрее) |

## Что уже есть в проекте

- В [apps/web/src/components/ProjectSelector.tsx](apps/web/src/components/ProjectSelector.tsx) — селектор с тремя опциями: `google/gemini-2.0-flash-001`, `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`.
- Модель хранится в проекте (`llm_model`), при генерации подсказок бэкенд использует `project.llm_model`; если не задано — fallback на `LLM_MODEL` из env.

## Рекомендации для UI

1. **Расширить список в селекторе** — добавить актуальные модели из таблиц выше (в т.ч. бесплатную `google/gemini-2.0-flash-exp:free`, Gemini 2.5 Pro, Claude Sonnet 4/4.5, GPT-4o/mini), с человекочитаемыми подписями.
2. **Вынести список в константу** — например в `packages/shared` или `apps/web/src/lib/openRouterModels.ts`, чтобы один раз править список и переиспользовать (подсказки, тултипы).
3. **Опционально: свой вариант** — одна опция «Другая (ввести id)» + поле ввода, либо отдельный endpoint `GET /api/models` с кешем ответа OpenRouter (требует ключ на бэкенде).

## Ссылки

- [OpenRouter Models](https://openrouter.ai/models)
- [List available models (API)](https://openrouter.ai/docs/api-reference/list-available-models)
