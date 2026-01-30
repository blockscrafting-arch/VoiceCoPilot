import { useCallback, useEffect, useRef } from "react";
import { AudioWebSocket, generateSuggestions } from "../lib/api";
import {
  BrowserSpeechService,
  isBrowserSpeechAvailable,
} from "../services/speechRecognition";
import { useAppStore } from "../stores/appStore";
import { useProjectStore } from "../stores/projectStore";
import { useAudioCapture } from "./useAudioCapture";

/**
 * Debounce delay for suggestions generation (higher = fewer requests when transcript updates often).
 */
const SUGGESTION_DEBOUNCE_MS = 1600;

/** How long to reuse cached suggestions for the same request key (ms). */
const SUGGESTION_CACHE_TTL_MS = 15000;

/** Max last messages sent to suggestions API (smaller = faster). */
const SUGGESTION_HISTORY_SIZE = 6;

/** Delay before flushing browser STT buffer (ms); longer = more complete phrases. */
const BROWSER_STT_FLUSH_MS = 1100;
/** Min length to send buffered browser transcript (avoid tiny fragments). */
const BROWSER_STT_MIN_SEND_CHARS = 6;
/** Min message length to include in suggestions history. */
const SUGGESTION_MIN_MESSAGE_CHARS = 12;

/**
 * Hook that wires live audio capture, WebSocket streaming,
 * and AI suggestions into the application state.
 */
export function useLiveStreaming() {
  const {
    isRecording,
    transcript,
    setConnected,
    setRecording,
    setLoadingSuggestions,
    addMessage,
    setSuggestions,
    sttUserMode,
    singleSpeakerMode,
  } = useAppStore();
  const { contextText, currentProjectId } = useProjectStore();

  const effectiveSttUserMode =
    isBrowserSpeechAvailable() ? sttUserMode : "server";

  const wsRef = useRef<AudioWebSocket | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechService | null>(null);
  const browserTranscriptRef = useRef<string>("");
  const browserFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastTranscriptRef = useRef<{ user: string; other: string }>({
    user: "",
    other: "",
  });
  const suggestionCacheRef = useRef<{
    key: string;
    suggestions: string[];
    at: number;
  } | null>(null);

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
    { enableOther: !singleSpeakerMode }
  );

  const startStreaming = useCallback(async () => {
    if (isRecording) {
      return;
    }

    const ws = new AudioWebSocket();
    wsRef.current = ws;

    ws.connect({
      onTranscript: (text, speaker) => {
        if (singleSpeakerMode && speaker === "other") {
          return;
        }
        const t = text.trim();
        if (!t) {
          return;
        }
        const role = speaker === "user" ? "user" : "other";
        const key = role === "user" ? "user" : "other";
        if (lastTranscriptRef.current[key] === t) {
          return;
        }
        lastTranscriptRef.current[key] = t;
        addMessage(role, text);
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
          if (!t) return;
          // Only buffer final segments to avoid duplicating interim+final for same phrase
          if (!isFinal) return;
          const buf = browserTranscriptRef.current;
          browserTranscriptRef.current = buf ? `${buf} ${t}` : t;
          if (browserFlushTimerRef.current) {
            clearTimeout(browserFlushTimerRef.current);
          }
          browserFlushTimerRef.current = setTimeout(() => {
            browserFlushTimerRef.current = null;
            const toSend = browserTranscriptRef.current.trim();
            browserTranscriptRef.current = "";
            if (toSend.length >= BROWSER_STT_MIN_SEND_CHARS) {
              wsRef.current?.sendClientTranscript("user", toSend);
            }
          }, BROWSER_STT_FLUSH_MS);
        },
      });
    }
  }, [
    addMessage,
    currentProjectId,
    isRecording,
    setConnected,
    setRecording,
    startCapture,
    effectiveSttUserMode,
    singleSpeakerMode,
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
      wsRef.current.sendClientTranscript("user", pending);
    }
    browserTranscriptRef.current = "";
    browserSpeechRef.current?.stop();
    browserSpeechRef.current = null;
    await stopCapture();
    wsRef.current?.disconnect();
    wsRef.current = null;
    setConnected(false);
    setRecording(false);
  }, [isRecording, setConnected, setRecording, stopCapture]);

  useEffect(() => {
    if (transcript.length === 0) {
      return;
    }
    // Generate when last is "other" (two channels) or when transcript has only "user" (single-speaker / mic only)
    const lastRole = transcript[transcript.length - 1]?.role;
    const hasOther = transcript.some((m) => m.role === "other");
    if (lastRole !== "other" && hasOther) {
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    abortRef.current?.abort();
    abortRef.current = null;

    setLoadingSuggestions(true);
    debounceRef.current = window.setTimeout(async () => {
      let raw = transcript.slice(-SUGGESTION_HISTORY_SIZE);
      if (singleSpeakerMode) {
        raw = raw.filter((m) => m.role === "user");
      }
      raw = raw.filter((m) => m.text.trim().length >= SUGGESTION_MIN_MESSAGE_CHARS);
      const history = raw.filter(
        (m, i) => i === 0 || m.text !== raw[i - 1].text || m.role !== raw[i - 1].role
      );
      if (history.length === 0) {
        setLoadingSuggestions(false);
        return;
      }
      const requestKey = JSON.stringify({
        h: history.map((m) => `${m.role}:${m.text}`),
        c: contextText,
        p: currentProjectId ?? "default",
      });
      const cached = suggestionCacheRef.current;
      const now = Date.now();
      if (
        cached &&
        cached.key === requestKey &&
        now - cached.at < SUGGESTION_CACHE_TTL_MS
      ) {
        setSuggestions(cached.suggestions);
        setLoadingSuggestions(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const suggestions = await generateSuggestions(
          history,
          contextText,
          currentProjectId ?? undefined,
          controller.signal
        );
        if (!controller.signal.aborted) {
          suggestionCacheRef.current = {
            key: requestKey,
            suggestions,
            at: Date.now(),
          };
          setSuggestions(suggestions);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          return;
        }
        // #region agent log
        if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useLiveStreaming.ts:104',message:'suggestions_fetch_error',data:{error:e instanceof Error ? e.message : String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        console.error("Failed to generate suggestions", e);
        if (!controller.signal.aborted) {
          setLoadingSuggestions(false);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [
    contextText,
    currentProjectId,
    setLoadingSuggestions,
    setSuggestions,
    singleSpeakerMode,
    transcript,
  ]);

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
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
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
    error,
  };
}
