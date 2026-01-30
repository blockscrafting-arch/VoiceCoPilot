import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjectStore } from "../stores/projectStore";
import {
  OPENROUTER_MODEL_GROUPS,
  OPENROUTER_MODEL_VALUES,
} from "../lib/openRouterModels";

/**
 * Project selection and creation controls.
 */
export function ProjectSelector() {
  const {
    projects,
    currentProjectId,
    llmModel,
    isLoading,
    error,
    loadProjects,
    selectProject,
    createNewProject,
    updateModel,
  } = useProjectStore();

  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

    void loadProjects();

    if (!isTauri) {
      return;
    }

    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen("sidecar-ready", () => {
        // #region agent log
        if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProjectSelector.tsx:20',message:'sidecar_ready_event',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        void loadProjects();
      });
    };

    void setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadProjects]);

  const handleCreate = async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      return;
    }
    await createNewProject(trimmed);
    setNewProjectName("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="bg-gray-900 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700"
          value={currentProjectId ?? ""}
          onChange={(event) => selectProject(event.target.value)}
          disabled={isLoading || projects.length === 0}
        >
          {projects.length === 0 ? (
            <option value="">Нет проектов</option>
          ) : (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          )}
        </select>
        <input
          className="bg-gray-900 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700"
          placeholder="Новый проект"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
        />
        <button
          className="bg-primary-600 text-white text-sm px-3 py-2 rounded-md hover:bg-primary-500 disabled:opacity-50"
          onClick={handleCreate}
          disabled={isLoading || !newProjectName.trim()}
        >
          Создать
        </button>
        <span className="text-xs text-gray-500">Модель (OpenRouter):</span>
        <select
          className="bg-gray-900 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700"
          value={llmModel}
          onChange={(event) => updateModel(event.target.value)}
          disabled={isLoading || !currentProjectId}
          title="Модель LLM для подсказок"
        >
          {llmModel &&
            !OPENROUTER_MODEL_VALUES.includes(llmModel) && (
              <option value={llmModel}>
                Текущая: {llmModel}
              </option>
            )}
          {OPENROUTER_MODEL_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
