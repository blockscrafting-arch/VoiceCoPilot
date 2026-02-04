import { useCallback, useEffect, useRef } from "react";
import { AudioWebSocket, generateReply } from "../lib/api";
import { buildSuggestionHistory } from "../lib/suggestionHistory";
import {
  BrowserSpeechService,
  isBrowserSpeechAvailable,
} from "../services/speechRecognition";
import { useAppStore } from "../stores/appStore";
import { useProjectStore } from "../stores/projectStore";
import { useAudioCapture } from "./useAudioCapture";

/** Delay before flushing browser STT after last result (ms); reset on any interim/final to avoid micro-pause breaks. */
const BROWSER_STT_FLUSH_MS = 1800;
/** Min length to send buffered browser transcript (avoid tiny fragments). */
const BROWSER_STT_MIN_SEND_CHARS = 6;
/** Merge server transcription chunks into one message if within this window (ms). */
const MERGE_WINDOW_MS = 1800;
/** If same text arrived from the other speaker within this window (ms), treat as echo and skip. */
const ECHO_GUARD_WINDOW_MS = 4000;

/**
 * Hook that wires live audio capture, WebSocket streaming,
 * and AI suggestions into the application state.
 */
export function useLiveStreaming() {
  const {
    isRecording,
    setConnected,
    setRecording,
    addMessage,
    updateOrAppendDraft,
    finalizeDraft,
    appendToLastMessage,
    addSuggestionRequest,
    setSuggestionResult,
    setOtherAudioSource,
    sttUserMode,
  } = useAppStore();
  const { contextText, currentProjectId } = useProjectStore();

  const effectiveSttUserMode =
    sttUserMode === "auto"
      ? isBrowserSpeechAvailable()
        ? "browser"
        : "server"
      : sttUserMode === "browser" && isBrowserSpeechAvailable()
        ? "browser"
        : "server";

  const wsRef = useRef<AudioWebSocket | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechService | null>(null);
  const browserTranscriptRef = useRef<string>("");
  const browserFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef<{ user: string; other: string }>({
    user: "",
    other: "",
  });
  /** Echo filter: skip adding when server echoes back our client_transcript. */
  const lastSentClientTranscriptRef = useRef<string | null>(null);
  const lastOtherTimeRef = useRef<number>(0);
  const lastUserTimeRef = useRef<number>(0);
  /** Echo guard: last normalized text + time per role; skip if other role had same text recently. */
  const lastTextByRoleRef = useRef<{ user: { text: string; at: number }; other: { text: string; at: number } }>({
    user: { text: "", at: 0 },
    other: { text: "", at: 0 },
  });

  const { startCapture, stopCapture, error } = useAudioCapture(
    (chunk, speaker) => {
      const ws = wsRef.current;
      if (!ws) {
        return;
      }
      if (speaker === "user" && effectiveSttUserMode === "browser") {
        return;
      }
      const buffer = new Uint8Array(chunk).buffer;
      ws.sendAudio({ audioData: buffer, speaker });
    },
    (config) => {
      const ws = wsRef.current;
      if (!ws) {
        return;
      }
      ws.sendConfig({
        speaker: config.speaker,
        sampleRate: config.sample_rate,
        channels: config.channels,
        projectId: currentProjectId ?? "default",
        source: config.source,
      });
    },
    { enableOther: true }
  );

  const startStreaming = useCallback(async () => {
    if (isRecording) {
      return;
    }

    const ws = new AudioWebSocket();
    wsRef.current = ws;

    ws.connect({
      onTranscript: (text, speaker) => {
        const t = text.trim();
        if (!t) {
          return;
        }
        const role = speaker === "user" ? "user" : "other";
        const key = role === "user" ? "user" : "other";
        const now = Date.now();
        if (role === "user" && lastSentClientTranscriptRef.current === t) {
          lastSentClientTranscriptRef.current = null;
          return;
        }
        const normalized = t.replace(/\s+/g, " ").trim();
        const otherRole = role === "user" ? "other" : "user";
        const otherEntry = lastTextByRoleRef.current[otherRole];
        if (
          normalized.length >= 2 &&
          otherEntry.text === normalized &&
          now - otherEntry.at < ECHO_GUARD_WINDOW_MS
        ) {
          return;
        }
        const currentTranscript = useAppStore.getState().transcript;
        const lastMsg = currentTranscript[currentTranscript.length - 1];
        if (role === "other") {
          if (lastMsg?.role === "other" && !lastMsg?.isDraft && now - lastOtherTimeRef.current < MERGE_WINDOW_MS) {
            lastOtherTimeRef.current = now;
            lastTextByRoleRef.current.other = { text: normalized, at: now };
            appendToLastMessage("other", t);
            return;
          }
          lastOtherTimeRef.current = now;
        } else {
          if (effectiveSttUserMode === "server") {
            if (lastMsg?.role === "user" && !lastMsg?.isDraft && now - lastUserTimeRef.current < MERGE_WINDOW_MS) {
              lastUserTimeRef.current = now;
              lastTextByRoleRef.current.user = { text: normalized, at: now };
              appendToLastMessage("user", t);
              return;
            }
            lastUserTimeRef.current = now;
          }
        }
        lastTextByRoleRef.current[key] = { text: normalized, at: now };
        lastTranscriptRef.current[key] = t;
        addMessage(role, t);
      },
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onError: () => setConnected(false),
    });

    const configs = await startCapture();
    if (!configs) {
      ws.disconnect();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    const otherConfig = configs.find((c) => c.speaker === "other");
    setOtherAudioSource(
      otherConfig?.source === "extension"
        ? "extension"
        : otherConfig?.source === "display"
          ? "display"
          : null
    );

    configs.forEach((config) => {
      ws.sendConfig({
        speaker: config.speaker,
        sampleRate: config.sample_rate,
        channels: config.channels,
        projectId: currentProjectId ?? "default",
        source: config.source,
      });
    });
    setRecording(true);

    if (effectiveSttUserMode === "browser") {
      browserTranscriptRef.current = "";
      if (browserFlushTimerRef.current) {
        clearTimeout(browserFlushTimerRef.current);
        browserFlushTimerRef.current = null;
      }
      const browserSpeech = new BrowserSpeechService();
      browserSpeechRef.current = browserSpeech;
      browserSpeech.start({
        onResult: (text, isFinal) => {
          const t = text.trim();
          if (browserFlushTimerRef.current) {
            clearTimeout(browserFlushTimerRef.current);
            browserFlushTimerRef.current = null;
          }
          const scheduleFlush = () => {
            browserFlushTimerRef.current = setTimeout(() => {
              browserFlushTimerRef.current = null;
              const toSend = browserTranscriptRef.current.trim();
              browserTranscriptRef.current = "";
              if (toSend.length >= BROWSER_STT_MIN_SEND_CHARS) {
                finalizeDraft("user");
                lastSentClientTranscriptRef.current = toSend;
                wsRef.current?.sendClientTranscript("user", toSend);
              }
            }, BROWSER_STT_FLUSH_MS);
          };
          if (!isFinal) {
            if (t) updateOrAppendDraft("user", t);
            scheduleFlush();
            return;
          }
          if (!t) {
            scheduleFlush();
            return;
          }
          const buf = browserTranscriptRef.current;
          browserTranscriptRef.current = buf ? `${buf} ${t}` : t;
          const toShow = browserTranscriptRef.current.trim();
          if (toShow) updateOrAppendDraft("user", toShow);
          scheduleFlush();
        },
      });
    }
  }, [
    addMessage,
    appendToLastMessage,
    currentProjectId,
    finalizeDraft,
    isRecording,
    setConnected,
    setRecording,
    setOtherAudioSource,
    startCapture,
    effectiveSttUserMode,
    updateOrAppendDraft,
  ]);

  const stopStreaming = useCallback(async () => {
    if (!isRecording) {
      return;
    }

    if (browserFlushTimerRef.current) {
      clearTimeout(browserFlushTimerRef.current);
      browserFlushTimerRef.current = null;
    }
    const pending = browserTranscriptRef.current.trim();
    if (pending.length >= BROWSER_STT_MIN_SEND_CHARS && wsRef.current) {
      finalizeDraft("user");
      lastSentClientTranscriptRef.current = pending;
      wsRef.current.sendClientTranscript("user", pending);
    }
    browserTranscriptRef.current = "";
    browserSpeechRef.current?.stop();
    browserSpeechRef.current = null;
    await stopCapture();
    wsRef.current?.disconnect();
    wsRef.current = null;
    setOtherAudioSource(null);
    setConnected(false);
    setRecording(false);
  }, [
    finalizeDraft,
    isRecording,
    setConnected,
    setRecording,
    setOtherAudioSource,
    stopCapture,
  ]);

  const requestSuggestion = useCallback(() => {
    const state = useAppStore.getState();
    const projectState = useProjectStore.getState();
    const history = buildSuggestionHistory(state.transcript);
    if (history.length === 0) {
      return;
    }
    const id = crypto.randomUUID();
    addSuggestionRequest(id);
    const ctx = projectState.contextText;
    const projectId = projectState.currentProjectId ?? undefined;
    generateReply(history, ctx, projectId)
      .then((reply) => setSuggestionResult(id, "done", reply))
      .catch((e) => {
        console.error("Failed to generate reply", e);
        setSuggestionResult(
          id,
          "error",
          e instanceof Error ? e.message : String(e)
        );
      });
  }, [addSuggestionRequest, setSuggestionResult]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && event.target === document.body) {
        event.preventDefault();
        if (isRecording) {
          void stopStreaming();
        } else {
          void startStreaming();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, startStreaming, stopStreaming]);

  useEffect(() => {
    return () => {
      if (browserFlushTimerRef.current) {
        clearTimeout(browserFlushTimerRef.current);
      }
      browserSpeechRef.current?.stop();
      browserSpeechRef.current = null;
      wsRef.current?.disconnect();
    };
  }, []);

  return {
    startStreaming,
    stopStreaming,
    requestSuggestion,
    error,
  };
}
