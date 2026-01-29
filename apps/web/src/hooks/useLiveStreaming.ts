import { useCallback, useEffect, useRef } from "react";
import { AudioWebSocket, generateSuggestions } from "../lib/api";
import { useAppStore } from "../stores/appStore";
import { useProjectStore } from "../stores/projectStore";
import { useAudioCapture } from "./useAudioCapture";

/**
 * Debounce delay for suggestions generation.
 */
const SUGGESTION_DEBOUNCE_MS = 900;

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
        if (!text.trim()) {
          return;
        }
        const role = speaker === "user" ? "user" : "other";
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

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    setLoadingSuggestions(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const suggestions = await generateSuggestions(
          transcript.slice(-10),
          contextText,
          currentProjectId ?? undefined
        );
        setSuggestions(suggestions);
      } catch (e) {
        // #region agent log
        if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useLiveStreaming.ts:104',message:'suggestions_fetch_error',data:{error:e instanceof Error ? e.message : String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        console.error("Failed to generate suggestions", e);
        setLoadingSuggestions(false);
      }
    }, SUGGESTION_DEBOUNCE_MS);
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
