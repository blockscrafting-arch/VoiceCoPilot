import { create } from "zustand";
import {
  Project,
  createProject,
  fetchProjects,
  setToken,
  updateProject,
  uploadContextFile,
} from "../lib/api";

/**
 * Project state and actions.
 */
interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  contextText: string;
  llmModel: string;
  isLoading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => void;
  createNewProject: (name: string) => Promise<void>;
  updateContext: (context: string) => Promise<void>;
  updateModel: (model: string) => Promise<void>;
  uploadFile: (file: File, mode?: "append" | "replace") => Promise<void>;
  setError: (error: string | null) => void;
}

/**
 * Zustand store for project management.
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  contextText: "",
  llmModel: "",
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    // #region agent log
    if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'projectStore.ts:39',message:'projects_load_start',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    try {
      const storedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("voicecopilot_token")
          : null;
      let projects: Project[] = [];
      if (!storedToken) {
        const project = await createProject("default");
        if (project.token) {
          setToken(project.token);
        }
        projects = [project];
      } else {
        projects = await fetchProjects();
      }
      set({
        projects,
        currentProjectId: projects[0]?.id ?? null,
        contextText: projects[0]?.context_text ?? "",
        llmModel: projects[0]?.llm_model ?? "",
      });
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'projectStore.ts:48',message:'projects_load_ok',data:{count:projects.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
      // #region agent log
      if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'projectStore.ts:56',message:'projects_load_error',data:{error:message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    } finally {
      set({ isLoading: false });
    }
  },

  selectProject: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId) || null;
    set({
      currentProjectId: project?.id ?? null,
      contextText: project?.context_text ?? "",
      llmModel: project?.llm_model ?? "",
    });
  },

  createNewProject: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const project = await createProject(name);
      if (project.token) {
        setToken(project.token);
      }
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
        contextText: project.context_text,
        llmModel: project.llm_model,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateContext: async (context) => {
    const projectId = get().currentProjectId;
    if (!projectId) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const updated = await updateProject(projectId, {
        context_text: context,
      });
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === updated.id ? updated : project
        ),
        contextText: updated.context_text,
        llmModel: updated.llm_model,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateModel: async (model) => {
    const projectId = get().currentProjectId;
    if (!projectId) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const updated = await updateProject(projectId, {
        llm_model: model,
      });
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === updated.id ? updated : project
        ),
        llmModel: updated.llm_model,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFile: async (file, mode = "append") => {
    const projectId = get().currentProjectId;
    if (!projectId) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const updated = await uploadContextFile(projectId, file, mode);
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === updated.id ? updated : project
        ),
        contextText: updated.context_text,
        llmModel: updated.llm_model,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  setError: (error) => set({ error }),
}));
