import { create } from "zustand";

/**
 * Message in the conversation transcript.
 * isDraft: true = live updating line (interim), not yet finalized.
 */
export interface Message {
  role: "user" | "other";
  text: string;
  isDraft?: boolean;
}

/** How user (mic) transcription is done: auto (browser if available else server), browser, or server. */
export type SttUserMode = "auto" | "browser" | "server";

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

  /** User mic STT: auto (browser if available else server), browser, or server. */
  sttUserMode: SttUserMode;

  // Actions
  setConnected: (isConnected: boolean) => void;
  setRecording: (isRecording: boolean) => void;
  setLoadingSuggestions: (isLoading: boolean) => void;
  addMessage: (role: "user" | "other", text: string) => void;
  /** Update or append a draft line for role (live interim). */
  updateOrAppendDraft: (role: "user" | "other", text: string) => void;
  /** Mark current draft for role as final. */
  finalizeDraft: (role: "user" | "other") => void;
  /** Append text to last message of role (merge within pause window). */
  appendToLastMessage: (role: "user" | "other", text: string) => void;
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
  sttUserMode: "auto",

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
   * Add a message to the transcript (final).
   */
  addMessage: (role, text) => {
    set((state) => ({
      transcript: [...state.transcript, { role, text, isDraft: false }],
    }));
  },

  /**
   * Update or append a draft line for role (live interim).
   */
  updateOrAppendDraft: (role, text) => {
    set((state) => {
      const last = state.transcript[state.transcript.length - 1];
      if (last?.role === role && last?.isDraft) {
        const next = [...state.transcript];
        next[next.length - 1] = { ...last, text };
        return { transcript: next };
      }
      return {
        transcript: [...state.transcript, { role, text, isDraft: true }],
      };
    });
  },

  /**
   * Mark current draft for role as final.
   */
  finalizeDraft: (role) => {
    set((state) => {
      const last = state.transcript[state.transcript.length - 1];
      if (last?.role === role && last?.isDraft) {
        const next = [...state.transcript];
        next[next.length - 1] = { ...last, isDraft: false };
        return { transcript: next };
      }
      return state;
    });
  },

  /**
   * Append text to last message of role (merge within pause window).
   */
  appendToLastMessage: (role, text) => {
    set((state) => {
      const last = state.transcript[state.transcript.length - 1];
      if (last?.role === role && !last?.isDraft) {
        const next = [...state.transcript];
        next[next.length - 1] = {
          ...last,
          text: (last.text + " " + text).trim(),
        };
        return { transcript: next };
      }
      return {
        transcript: [...state.transcript, { role, text, isDraft: false }],
      };
    });
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
