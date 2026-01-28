/**
 * Shared constants for VoiceCoPilot.
 */

/**
 * Default API server URL.
 */
export const DEFAULT_API_URL = "http://127.0.0.1:8000";

/**
 * WebSocket endpoint paths.
 */
export const WS_ENDPOINTS = {
  AUDIO_STREAM: "/api/audio/stream",
} as const;

/**
 * API endpoint paths.
 */
export const API_ENDPOINTS = {
  HEALTH: "/health",
  SUGGESTIONS: "/api/suggestions/generate",
} as const;

/**
 * Audio capture settings.
 */
export const AUDIO_SETTINGS = {
  /** Target sample rate for STT */
  SAMPLE_RATE: 16000,
  /** Number of channels (mono) */
  CHANNELS: 1,
  /** Bits per sample */
  BITS_PER_SAMPLE: 16,
  /** Chunk duration in milliseconds */
  CHUNK_DURATION_MS: 100,
} as const;

/**
 * LLM model identifiers.
 */
export const LLM_MODELS = {
  GEMINI_FLASH: "google/gemini-2.0-flash-001",
  GEMINI_FLASH_25: "google/gemini-2.5-flash",
} as const;

/**
 * Keyboard shortcuts.
 */
export const KEYBOARD_SHORTCUTS = {
  TOGGLE_RECORDING: "Space",
  HIDE_WINDOW: "Escape",
  COPY_SUGGESTION: "Enter",
} as const;
