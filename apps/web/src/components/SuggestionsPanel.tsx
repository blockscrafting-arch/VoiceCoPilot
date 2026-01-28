import { useAppStore } from "../stores/appStore";

/**
 * Panel displaying AI-generated conversation suggestions.
 * Shows what to say next based on the conversation context.
 */
export function SuggestionsPanel() {
  const { suggestions, isLoadingSuggestions } = useAppStore();

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="font-medium text-gray-200">Подсказки</h2>
        <p className="text-xs text-gray-500 mt-0.5">Что можно сказать</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            <p>Подсказки появятся во время разговора</p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
              onClick={() => {
                // Copy to clipboard
                navigator.clipboard.writeText(suggestion);
              }}
            >
              <p className="text-sm text-gray-200">{suggestion}</p>
              <p className="text-xs text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Нажмите, чтобы скопировать
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
