import { useAppStore } from "../stores/appStore";
import type { SttUserMode } from "../stores/appStore";
import { isBrowserSpeechAvailable } from "../services/speechRecognition";

interface ControlsProps {
  /** Start streaming */
  onStart: () => void;
  /** Stop streaming */
  onStop: () => void;
  /** Optional error message */
  error?: string | null;
}

/**
 * Recording control buttons.
 * Start/stop recording and clear transcript.
 */
export function Controls({ onStart, onStop, error }: ControlsProps) {
  const {
    isRecording,
    clearTranscript,
    sttUserMode,
    setSttUserMode,
    singleSpeakerMode,
    setSingleSpeakerMode,
  } = useAppStore();
  const showSttToggle = isBrowserSpeechAvailable();

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
      {/* Single speaker: only mic, no system/extension audio */}
      <label className="flex items-center gap-2 cursor-pointer" title="Только микрофон: не захватывать системный звук; подсказки по вашей речи">
        <input
          type="checkbox"
          checked={singleSpeakerMode}
          onChange={(e) => setSingleSpeakerMode(e.target.checked)}
          className="rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-xs text-gray-400">Один спикер</span>
      </label>

      {/* STT mode for mic: browser (Chrome) or server */}
      {showSttToggle && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Микрофон:</span>
          <select
            value={sttUserMode}
            onChange={(e) => setSttUserMode(e.target.value as SttUserMode)}
            className="text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            title="Браузер — распознавание в Chrome без сервера. Сервер — через OpenAI."
          >
            <option value="browser">браузер (Chrome)</option>
            <option value="server">сервер</option>
          </select>
        </div>
      )}

      {/* Start/Stop Recording */}
      <button
        onClick={isRecording ? onStop : onStart}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-primary-500 hover:bg-primary-600 text-white"
        }`}
      >
        {isRecording ? (
          <>
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Остановить эфир
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            Начать эфир
          </>
        )}
      </button>

      {/* Clear Transcript */}
      <button
        onClick={clearTranscript}
        className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Очистить
      </button>

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-500 ml-4">
        <span className="px-1.5 py-0.5 bg-gray-700 rounded">Space</span> — эфир
        <span className="mx-2">|</span>
        <span className="px-1.5 py-0.5 bg-gray-700 rounded">Esc</span> — скрыть
      </div>

      {error && (
        <div className="ml-4 text-xs text-red-400 max-w-[320px]">
          {error}
        </div>
      )}
    </div>
  );
}
