import { Header } from "./components/Header";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SuggestionsPanel } from "./components/SuggestionsPanel";
import { Controls } from "./components/Controls";
import { ProjectSelector } from "./components/ProjectSelector";
import { ContextPanel } from "./components/ContextPanel";
import { useAppStore } from "./stores/appStore";
import { useLiveStreaming } from "./hooks/useLiveStreaming";

/**
 * Main application component.
 * Renders the voice copilot UI with transcript and suggestions panels.
 */
function App() {
  const { isRecording } = useAppStore();
  const { startStreaming, stopStreaming, error } = useLiveStreaming();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
          <ProjectSelector />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Transcript panel - left side */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
            <ContextPanel />
            <div className="flex-1 overflow-hidden">
              <TranscriptPanel />
            </div>
          </div>

          {/* Suggestions panel - right side */}
          <div className="w-80 p-4 border-l border-gray-700 overflow-hidden">
            <SuggestionsPanel />
          </div>
        </div>
      </main>

      {/* Controls at the bottom */}
      <Controls onStart={startStreaming} onStop={stopStreaming} error={error} />

      {/* Recording indicator */}
      {isRecording && (
        <div className="fixed top-4 right-4 flex items-center gap-2 bg-red-500/20 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full recording-indicator" />
          <span className="text-red-400 text-sm font-medium">Эфир</span>
        </div>
      )}
    </div>
  );
}

export default App;
