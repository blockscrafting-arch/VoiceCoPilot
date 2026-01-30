/**
 * Curated OpenRouter model options for the project LLM selector.
 * Grouped by provider; no Anthropic. Balanced and cheap/fast options.
 * @see https://openrouter.ai/models
 */

export interface OpenRouterModelOption {
  value: string;
  label: string;
}

export interface OpenRouterModelGroup {
  label: string;
  options: OpenRouterModelOption[];
}

export const OPENROUTER_MODEL_GROUPS: OpenRouterModelGroup[] = [
  {
    label: "OpenAI",
    options: [
      { value: "openai/gpt-4o", label: "GPT-4o" },
      { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "openai/o1", label: "o1 (reasoning)" },
      { value: "openai/o1-mini", label: "o1-mini (reasoning)" },
    ],
  },
  {
    label: "DeepSeek",
    options: [
      { value: "deepseek/deepseek-chat", label: "DeepSeek Chat (V3)" },
      { value: "deepseek/deepseek-chat-v3", label: "DeepSeek Chat V3" },
    ],
  },
  {
    label: "Google",
    options: [
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
      { value: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (free)" },
      { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (legacy)" },
    ],
  },
  {
    label: "xAI",
    options: [
      { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast" },
      { value: "x-ai/grok-4-fast", label: "Grok 4 Fast" },
      { value: "x-ai/grok-code-fast-1", label: "Grok Code Fast" },
    ],
  },
  {
    label: "Mistral",
    options: [
      { value: "mistralai/mistral-large", label: "Mistral Large" },
      { value: "mistralai/mistral-small", label: "Mistral Small" },
    ],
  },
];

/** Flat list of all model values (for default/fallback). */
export const OPENROUTER_MODEL_VALUES = OPENROUTER_MODEL_GROUPS.flatMap(
  (g) => g.options.map((o) => o.value)
);
