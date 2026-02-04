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

/** Single suggestion request (one card). */
export interface SuggestionEntry {
  id: string;
  status: "loading" | "done" | "error";
  text?: string | null;
  error?: string | null;
}

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

  /** List of suggestion requests (parallel cards). */
  suggestions: SuggestionEntry[];

  /** Source of "other" (interlocutor) audio: extension, display/tab, or none. */
  otherAudioSource: "extension" | "display" | null;

  /** User mic STT: auto (browser if available else server), browser, or server. */
  sttUserMode: SttUserMode;

  // Actions
  setConnected: (isConnected: boolean) => void;
  setRecording: (isRecording: boolean) => void;
  addMessage: (role: "user" | "other", text: string) => void;
  /** Update or append a draft line for role (live interim). */
  updateOrAppendDraft: (role: "user" | "other", text: string) => void;
  /** Mark current draft for role as final. */
  finalizeDraft: (role: "user" | "other") => void;
  /** Append text to last message of role (merge within pause window). */
  appendToLastMessage: (role: "user" | "other", text: string) => void;
  clearTranscript: () => void;
  setSttUserMode: (mode: SttUserMode) => void;
  setOtherAudioSource: (source: "extension" | "display" | null) => void;
  /** Add a new suggestion request (loading). Returns the id. */
  addSuggestionRequest: (id: string) => void;
  /** Set result for a suggestion request. */
  setSuggestionResult: (
    id: string,
    status: "done" | "error",
    textOrError: string
  ) => void;
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
  otherAudioSource: null,
  sttUserMode: "auto",

  setConnected: (isConnected) => set({ isConnected }),

  /**
   * Update recording status.
   */
  setRecording: (isRecording) => set({ isRecording }),

  /**
   * Add a message to the transcript (final).
   * Trims whitespace for consistent display.
   */
  addMessage: (role, text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return;
    set((state) => ({
      transcript: [...state.transcript, { role, text: trimmed, isDraft: false }],
    }));
  },

  /**
   * Update or append a draft line for role (live interim).
   * Finds the last message of this role in the list; if it's a draft, updates it; otherwise adds a new draft.
   * No-op if text is empty after trim.
   */
  updateOrAppendDraft: (role, text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return;
    set((state) => {
      let lastIdx = -1;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        if (state.transcript[i].role === role) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const last = state.transcript[lastIdx];
        if (last.isDraft) {
          const next = [...state.transcript];
          next[lastIdx] = { ...last, text: trimmed };
          return { transcript: next };
        }
      }
      return {
        transcript: [...state.transcript, { role, text: trimmed, isDraft: true }],
      };
    });
  },

  /**
   * Mark current draft for role as final.
   * Finds the last draft of this role and marks it final.
   */
  finalizeDraft: (role) => {
    set((state) => {
      let lastIdx = -1;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        if (state.transcript[i].role === role && state.transcript[i].isDraft) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const next = [...state.transcript];
        next[lastIdx] = { ...next[lastIdx], isDraft: false };
        return { transcript: next };
      }
      return state;
    });
  },

  /**
   * Append text to last final message of role (merge within pause window).
   * Finds the last non-draft message of this role and appends; otherwise adds new message.
   * Trims appended part for consistent display.
   */
  appendToLastMessage: (role, text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return;
    set((state) => {
      let lastIdx = -1;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        const m = state.transcript[i];
        if (m.role === role && !m.isDraft) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const last = state.transcript[lastIdx];
        const next = [...state.transcript];
        next[lastIdx] = {
          ...last,
          text: (last.text + " " + trimmed).trim(),
        };
        return { transcript: next };
      }
      return {
        transcript: [...state.transcript, { role, text: trimmed, isDraft: false }],
      };
    });
  },

  /**
   * Clear the conversation transcript and suggestions.
   */
  clearTranscript: () => {
    set({ transcript: [], suggestions: [] });
  },

  setSttUserMode: (sttUserMode) => set({ sttUserMode }),

  setOtherAudioSource: (otherAudioSource) => set({ otherAudioSource }),

  addSuggestionRequest: (id) => {
    set((state) => ({
      suggestions: [
        ...state.suggestions,
        { id, status: "loading" as const },
      ],
    }));
  },

  setSuggestionResult: (id, status, textOrError) => {
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              text: status === "done" ? textOrError : undefined,
              error: status === "error" ? textOrError : undefined,
            }
          : s
      ),
    }));
  },
}));
