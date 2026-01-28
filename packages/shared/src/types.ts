/**
 * Shared type definitions for VoiceCoPilot.
 */

/**
 * Message in conversation history.
 */
export interface Message {
  /** Speaker role: 'user' or 'other' */
  role: "user" | "other";
  /** Message text content */
  text: string;
  /** Timestamp when message was created */
  timestamp?: number;
}

/**
 * Transcription result from STT.
 */
export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Whether this is a final transcription */
  isFinal: boolean;
  /** Speaker identifier */
  speaker: "user" | "other";
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Suggestion from LLM.
 */
export interface Suggestion {
  /** Suggested text to say */
  text: string;
  /** Relevance score (0-1) */
  score?: number;
}

/**
 * Audio chunk for streaming.
 */
export interface AudioChunk {
  /** Raw audio data (PCM bytes) */
  data: ArrayBuffer;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Source of audio */
  source: "microphone" | "system";
}

/**
 * Application settings.
 */
export interface AppSettings {
  /** API server URL */
  apiUrl: string;
  /** Preferred LLM model */
  llmModel: string;
  /** STT language */
  sttLanguage: string;
  /** Enable system audio capture */
  captureSystemAudio: boolean;
}

/**
 * WebSocket message types.
 */
export type WSMessageType =
  | "transcription"
  | "suggestion"
  | "error"
  | "ping"
  | "pong";

/**
 * WebSocket message envelope.
 */
export interface WSMessage<T = unknown> {
  /** Message type */
  type: WSMessageType;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp: number;
}
