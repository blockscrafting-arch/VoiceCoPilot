import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

/**
 * Panel displaying the live conversation transcript.
 * Auto-scrolls to the latest message. Non-draft messages are editable (click to edit).
 */
export function TranscriptPanel() {
  const { transcript, editMessage } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleSaveEdit = useCallback(
    (index: number, newText: string) => {
      const trimmed = newText.trim();
      if (trimmed) editMessage(index, trimmed);
      setEditingIndex(null);
    },
    [editMessage]
  );

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="font-medium text-gray-200">Транскрипт</h2>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Транскрипт разговора"
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
                className={`max-w-[80%] px-4 py-2 rounded-lg group relative ${
                  message.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-700 text-gray-200"
                } ${message.isDraft ? "opacity-90 border border-dashed border-gray-500" : ""} ${
                  !message.isDraft ? "hover:ring-1 hover:ring-gray-500" : ""
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {message.role === "user" ? "Вы" : "Собеседник"}
                  {message.isDraft && " (ввод…)"}
                </div>
                {editingIndex === index ? (
                  <MessageEditor
                    initialText={message.text}
                    onSave={(text) => handleSaveEdit(index, text)}
                    onCancel={() => setEditingIndex(null)}
                  />
                ) : (
                  <p
                    className={`text-sm ${message.isDraft ? "italic text-gray-300" : ""} ${
                      !message.isDraft ? "cursor-text" : ""
                    }`}
                    onClick={() => !message.isDraft && setEditingIndex(index)}
                    role={message.isDraft ? undefined : "button"}
                    aria-label={message.isDraft ? undefined : "Редактировать сообщение"}
                  >
                    {message.text}
                  </p>
                )}
                {!message.isDraft && editingIndex !== index && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  >
                    ✎
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Inline editor for a transcript message. Save on Enter (no Shift) or blur; cancel on Escape.
 */
function MessageEditor({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const commit = useCallback(() => {
    onSave(value);
  }, [value, onSave]);

  const handleBlur = useCallback(() => {
    if (!cancelledRef.current) commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelledRef.current = true;
        onCancel();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
    },
    [onCancel, commit]
  );

  return (
    <textarea
      ref={textareaRef}
      className="w-full min-h-[2.5rem] text-sm bg-black/20 text-inherit border border-gray-500 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      rows={Math.max(2, value.split("\n").length)}
      aria-label="Редактировать текст сообщения"
    />
  );
}
