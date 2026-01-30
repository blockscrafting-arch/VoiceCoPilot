import { useAppStore } from "../stores/appStore";

/**
 * Panel displaying one AI-generated reply to the interlocutor.
 * User can copy the reply to say or send.
 */
export function SuggestionsPanel() {
  const { replyText, isLoadingSuggestions } = useAppStore();

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="font-medium text-gray-200">Ответ собеседнику</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : !replyText ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            <p>Ответ появится после реплики собеседника</p>
          </div>
        ) : (
          <button
            type="button"
            className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
            onClick={() => {
              navigator.clipboard.writeText(replyText);
            }}
          >
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{replyText}</p>
            <p className="text-xs text-gray-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Нажмите, чтобы скопировать
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
