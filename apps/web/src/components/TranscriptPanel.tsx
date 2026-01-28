import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

/**
 * Panel displaying the live conversation transcript.
 * Auto-scrolls to the latest message.
 */
export function TranscriptPanel() {
  const { transcript } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="font-medium text-gray-200">Транскрипт</h2>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {transcript.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Начните запись, чтобы увидеть транскрипт</p>
          </div>
        ) : (
          transcript.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-700 text-gray-200"
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {message.role === "user" ? "Вы" : "Собеседник"}
                </div>
                <p className="text-sm">{message.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
