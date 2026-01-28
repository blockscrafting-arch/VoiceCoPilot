import { useEffect, useState } from "react";
import { useProjectStore } from "../stores/projectStore";

/**
 * Context input panel for the current project.
 */
export function ContextPanel() {
  const { contextText, updateContext, currentProjectId, isLoading, uploadFile } =
    useProjectStore();
  const [draft, setDraft] = useState(contextText);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");

  useEffect(() => {
    setDraft(contextText);
  }, [contextText]);

  const handleSave = async () => {
    await updateContext(draft);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) {
      return;
    }
    for (const file of Array.from(files)) {
      await uploadFile(file, importMode);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
        Создайте проект, чтобы добавить контекст
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Контекст проекта</h3>
        <button
          className="bg-primary-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-primary-500 disabled:opacity-50"
          onClick={handleSave}
          disabled={isLoading}
        >
          Сохранить
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-300">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="context-mode"
            checked={importMode === "append"}
            onChange={() => setImportMode("append")}
          />
          Добавить
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="context-mode"
            checked={importMode === "replace"}
            onChange={() => setImportMode("replace")}
          />
          Заменить
        </label>
        <input
          type="file"
          className="text-xs text-gray-300"
          accept=".txt,.md,.pdf,.docx"
          multiple
          onChange={(event) => handleFileUpload(event.target.files)}
        />
      </div>
      <textarea
        className="bg-gray-900 text-gray-200 text-sm rounded-md p-3 border border-gray-700 min-h-[140px]"
        placeholder="Вставь сюда большой контекст: цели, детали проекта, договоренности..."
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
