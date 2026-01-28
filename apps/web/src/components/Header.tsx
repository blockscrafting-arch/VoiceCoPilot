import { useAppStore } from "../stores/appStore";

/**
 * Application header with title and connection status.
 */
export function Header() {
  const { isConnected } = useAppStore();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
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
        </div>
        <h1 className="text-lg font-semibold text-white">VoiceCoPilot</h1>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-gray-500"
          }`}
        />
        <span className="text-sm text-gray-400">
          {isConnected ? "Подключено" : "Отключено"}
        </span>
      </div>
    </header>
  );
}
