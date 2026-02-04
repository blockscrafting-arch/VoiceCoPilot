import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { canRequestSuggestion } from "../lib/suggestionHistory";
import { useAppStore } from "../stores/appStore";

interface SuggestionsPanelProps {
  /** Trigger a new suggestion request (snapshot of transcript at click time). */
  onRequestSuggestion: () => void;
}

const COPY_FEEDBACK_MS = 2000;

/**
 * Panel displaying AI-generated replies to the interlocutor.
 * User clicks "Дать подсказку" to generate; multiple requests run in parallel as separate cards.
 */
export function SuggestionsPanel({ onRequestSuggestion }: SuggestionsPanelProps) {
  const { suggestions, transcript } = useAppStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canRequest = useMemo(
    () => canRequestSuggestion(transcript),
    [transcript]
  );

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback((id: string, text: string) => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = setTimeout(() => {
          copyFeedbackTimerRef.current = null;
          setCopiedId(null);
        }, COPY_FEEDBACK_MS);
      },
      () => {}
    );
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-2">
        <h2 className="font-medium text-gray-200">Ответ собеседнику</h2>
        <button
          type="button"
          onClick={onRequestSuggestion}
          disabled={!canRequest}
          title={
            canRequest
              ? undefined
              : "Добавьте реплики в транскрипт (реплики от 12 символов)"
          }
          aria-label="Сгенерировать подсказку по текущему транскрипту"
          className="px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Дать подсказку
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {suggestions.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            <p>Нажмите «Дать подсказку», чтобы сгенерировать ответ по текущему транскрипту.</p>
            {!canRequest && transcript.length > 0 && (
              <p className="mt-2 text-gray-600 text-xs">
                Нужны реплики не короче 12 символов.
              </p>
            )}
          </div>
        ) : (
          [...suggestions].reverse().map((entry) => (
            <div
              key={entry.id}
              className="p-3 bg-gray-700/50 rounded-lg border border-gray-600"
            >
              {entry.status === "loading" && (
                <div
                  className="flex items-center justify-center py-4"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div
                    className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"
                    aria-hidden
                  />
                </div>
              )}
              {entry.status === "error" && (
                <p className="text-sm text-red-400">{entry.error ?? "Ошибка"}</p>
              )}
              {entry.status === "done" && (
                <>
                  {entry.text ? (
                    <button
                      type="button"
                      className="w-full text-left group"
                      onClick={() => handleCopy(entry.id, entry.text!)}
                      aria-label="Копировать в буфер обмена"
                    >
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">
                        {entry.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedId === entry.id ? "Скопировано" : "Нажмите, чтобы скопировать"}
                      </p>
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Пустой ответ</p>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
