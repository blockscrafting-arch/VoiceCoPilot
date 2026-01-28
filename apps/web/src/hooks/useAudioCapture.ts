import { useCallback, useRef, useState } from "react";

/**
 * Audio capture state and controls.
 */
interface AudioCaptureState {
  /** Whether audio capture is active */
  isCapturing: boolean;
  /** Error message if any */
  error: string | null;
  /** Start audio capture */
  startCapture: () => Promise<AudioStreamConfig[] | null>;
  /** Stop audio capture */
  stopCapture: () => Promise<void>;
}

/**
 * Audio stream configuration.
 */
type Speaker = "user" | "other";

interface AudioStreamConfig {
  /** Sample rate in Hz */
  sample_rate: number;
  /** Number of channels */
  channels: number;
  /** Speaker label */
  speaker: Speaker;
}

interface AudioChunkPayload {
  /** Speaker label */
  speaker: Speaker;
  /** Raw audio bytes */
  data: Uint8Array;
  /** Sample rate */
  sampleRate: number;
  /** Channels */
  channels: number;
}

/**
 * Hook for managing audio capture via Tauri.
 *
 * @param onAudioChunk - Callback for received audio chunks
 * @returns Audio capture state and controls
 */
export function useAudioCapture(
  onAudioChunk?: (data: Uint8Array, speaker: Speaker) => void,
  onConfig?: (config: AudioStreamConfig) => void
): AudioCaptureState {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const extensionListenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const extensionConfigSent = useRef(false);
  const micConfigSent = useRef(false);

  const startCapture = useCallback(async () => {
    try {
      setError(null);
      const configs: AudioStreamConfig[] = [];

      // Microphone capture via Web Audio API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i += 1) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        if (onAudioChunk) {
          onAudioChunk(new Uint8Array(pcm16.buffer), "user");
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      if (!micConfigSent.current && onConfig) {
        const micConfig = {
          sample_rate: audioContext.sampleRate,
          channels: 1,
          speaker: "user" as const,
        };
        onConfig(micConfig);
        configs.push(micConfig);
        micConfigSent.current = true;
      }

      // Extension listener for system audio
      const extensionListener = (event: MessageEvent) => {
        if (!event.data || event.data.source !== "voicecopilot-extension") {
          return;
        }
        if (event.data.type === "audioChunk") {
          const payload: AudioChunkPayload = {
            speaker: "other",
            data: new Uint8Array(event.data.data),
            sampleRate: event.data.sampleRate,
            channels: event.data.channels,
          };
          if (!extensionConfigSent.current && onConfig) {
            onConfig({
              sample_rate: payload.sampleRate,
              channels: payload.channels,
              speaker: "other",
            });
            configs.push({
              sample_rate: payload.sampleRate,
              channels: payload.channels,
              speaker: "other",
            });
            extensionConfigSent.current = true;
          }
          if (onAudioChunk) {
            onAudioChunk(payload.data, "other");
          }
        }
        if (event.data.type === "status" && event.data.status === "error") {
          setError(event.data.message || "Ошибка расширения");
        }
      };
      extensionListenerRef.current = extensionListener;
      window.addEventListener("message", extensionListener);

      // Ask extension to start capture
      window.postMessage(
        { source: "voicecopilot-web", type: "startCapture", mode: "system" },
        "*"
      );

      setIsCapturing(true);
      return configs;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      console.error("Failed to start capture:", e);
      return null;
    }
  }, [onAudioChunk, onConfig]);

  const stopCapture = useCallback(async () => {
    try {
      window.postMessage(
        { source: "voicecopilot-web", type: "stopCapture" },
        "*"
      );
      if (extensionListenerRef.current) {
        window.removeEventListener("message", extensionListenerRef.current);
        extensionListenerRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
      micConfigSent.current = false;
      extensionConfigSent.current = false;
      setIsCapturing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      console.error("Failed to stop capture:", e);
    }
  }, []);

  return {
    isCapturing,
    error,
    startCapture,
    stopCapture,
  };
}
