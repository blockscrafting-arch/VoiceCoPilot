import { useCallback, useEffect, useRef } from "react";
import { AudioWebSocket, generateSuggestions } from "../lib/api";
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
  } = useAppStore();
  const { contextText, currentProjectId } = useProjectStore();

  const wsRef = useRef<AudioWebSocket | null>(null);
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
    }
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
  }, [
    addMessage,
    currentProjectId,
    isRecording,
    setConnected,
    setRecording,
    startCapture,
  ]);

  const stopStreaming = useCallback(async () => {
    if (!isRecording) {
      return;
    }

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
      const raw = transcript.slice(-SUGGESTION_HISTORY_SIZE);
      const history = raw.filter(
        (m, i) => i === 0 || m.text !== raw[i - 1].text || m.role !== raw[i - 1].role
      );
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
      wsRef.current?.disconnect();
    };
  }, []);

  return {
    startStreaming,
    stopStreaming,
    error,
  };
}
