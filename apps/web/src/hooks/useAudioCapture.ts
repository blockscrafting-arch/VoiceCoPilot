import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Capture source */
  source?: "mic" | "extension" | "display";
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

export interface UseAudioCaptureOptions {
  /** If false, do not capture extension/display audio (mic only). Default true. */
  enableOther?: boolean;
}

/**
 * Hook for managing audio capture (mic + extension or getDisplayMedia fallback).
 *
 * @param onAudioChunk - Callback for received audio chunks
 * @param onConfig - Callback for stream config (sample rate, channels, speaker)
 * @param options - enableOther: false for single-speaker (mic only)
 * @returns Audio capture state and controls
 */
export function useAudioCapture(
  onAudioChunk?: (data: Uint8Array, speaker: Speaker) => void,
  onConfig?: (config: AudioStreamConfig) => void,
  options?: UseAudioCaptureOptions
): AudioCaptureState {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const extensionListenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const extensionConfigSent = useRef(false);
  const micConfigSent = useRef(false);
  const extensionAvailableRef = useRef(false);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const displayAudioContextRef = useRef<AudioContext | null>(null);
  const displayProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const displayConfigSent = useRef(false);

  // Detect extension via "ready" message from content script
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.data?.source === "voicecopilot-extension" && event.data?.type === "ready") {
        extensionAvailableRef.current = true;
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, []);

  const startCapture = useCallback(async () => {
    try {
      setError(null);
      const configs: AudioStreamConfig[] = [];

      // Microphone capture via Web Audio API
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

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
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      if (!micConfigSent.current && onConfig) {
        const micConfig = {
          sample_rate: audioContext.sampleRate,
          channels: 1,
          speaker: "user" as const,
          source: "mic" as const,
        };
        onConfig(micConfig);
        configs.push(micConfig);
        micConfigSent.current = true;
      }

      // "Other" audio: extension or getDisplayMedia fallback (skip when single-speaker)
      const enableOther = options?.enableOther !== false;
      if (enableOther && extensionAvailableRef.current) {
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
                source: "extension",
              });
              configs.push({
                sample_rate: payload.sampleRate,
                channels: payload.channels,
                speaker: "other",
                source: "extension",
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
        window.postMessage(
          { source: "voicecopilot-web", type: "startCapture", mode: "system" },
          "*"
        );
      } else if (enableOther) {
        // Fallback: getDisplayMedia (screen/tab + audio)
        if (!navigator.mediaDevices?.getDisplayMedia) {
          setError("Захват экрана недоступен в этом браузере");
          setIsCapturing(true);
          return configs;
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const audioTracks = displayStream.getAudioTracks();
        if (!audioTracks.length) {
          displayStream.getTracks().forEach((t) => t.stop());
          setError("Выберите экран или вкладку с включённым звуком");
          setIsCapturing(true);
          return configs;
        }
        displayStreamRef.current = displayStream;
        const displayCtx = new AudioContext();
        displayAudioContextRef.current = displayCtx;
        const displaySource = displayCtx.createMediaStreamSource(displayStream);
        const displayProcessor = displayCtx.createScriptProcessor(4096, 2, 1);
        displayProcessorRef.current = displayProcessor;
        const displaySilentGain = displayCtx.createGain();
        displaySilentGain.gain.value = 0;
        displayProcessor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const ch1 = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : null;
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i += 1) {
            let sample = input[i];
            if (ch1) sample = (sample + ch1[i]) / 2;
            sample = Math.max(-1, Math.min(1, sample));
            pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          }
          if (onAudioChunk) {
            onAudioChunk(new Uint8Array(pcm16.buffer), "other");
          }
        };
        displaySource.connect(displayProcessor);
        displayProcessor.connect(displaySilentGain);
        displaySilentGain.connect(displayCtx.destination);
        if (!displayConfigSent.current && onConfig) {
          const otherConfig = {
            sample_rate: displayCtx.sampleRate,
            channels: 1,
            speaker: "other" as const,
            source: "display" as const,
          };
          onConfig(otherConfig);
          configs.push(otherConfig);
          displayConfigSent.current = true;
        }
      }

      setIsCapturing(true);
      return configs;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      console.error("Failed to start capture:", e);
      return null;
    }
  }, [onAudioChunk, onConfig, options?.enableOther]);

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
      if (displayProcessorRef.current) {
        displayProcessorRef.current.disconnect();
        displayProcessorRef.current = null;
      }
      if (displayAudioContextRef.current) {
        await displayAudioContextRef.current.close();
        displayAudioContextRef.current = null;
      }
      if (displayStreamRef.current) {
        displayStreamRef.current.getTracks().forEach((track) => track.stop());
        displayStreamRef.current = null;
      }
      displayConfigSent.current = false;
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
