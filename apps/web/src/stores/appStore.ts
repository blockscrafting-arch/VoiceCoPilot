import { create } from "zustand";

/**
 * Message in the conversation transcript.
 */
interface Message {
  role: "user" | "other";
  text: string;
}

/** How user (mic) transcription is done: browser Web Speech API or server (OpenAI). */
export type SttUserMode = "browser" | "server";

/**
 * Application state interface.
 */
interface AppState {
  // Connection state
  isConnected: boolean;

  // Recording state
  isRecording: boolean;

  // Transcript
  transcript: Message[];

  // Suggestions
  suggestions: string[];
  isLoadingSuggestions: boolean;

  /** User mic STT: browser (Chrome) or server. Default browser when Web Speech API available. */
  sttUserMode: SttUserMode;

  // Actions
  setConnected: (isConnected: boolean) => void;
  setRecording: (isRecording: boolean) => void;
  setLoadingSuggestions: (isLoading: boolean) => void;
  addMessage: (role: "user" | "other", text: string) => void;
  clearTranscript: () => void;
  setSuggestions: (suggestions: string[]) => void;
  setSttUserMode: (mode: SttUserMode) => void;
}

/**
 * Global application state store using Zustand.
 */
export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isConnected: false,
  isRecording: false,
  transcript: [],
  suggestions: [],
  isLoadingSuggestions: false,
  sttUserMode: "browser",

  setConnected: (isConnected) => set({ isConnected }),

  /**
   * Update recording status.
   */
  setRecording: (isRecording) => set({ isRecording }),

  /**
   * Update suggestions loading state.
   */
  setLoadingSuggestions: (isLoading) => set({ isLoadingSuggestions: isLoading }),

  /**
   * Add a message to the transcript.
   */
  addMessage: (role, text) => {
    set((state) => ({
      transcript: [...state.transcript, { role, text }],
    }));
  },

  /**
   * Clear the conversation transcript.
   */
  clearTranscript: () => {
    set({ transcript: [], suggestions: [] });
  },

  setSuggestions: (suggestions) => {
    set({ suggestions, isLoadingSuggestions: false });
  },

  setSttUserMode: (sttUserMode) => set({ sttUserMode }),
}));
