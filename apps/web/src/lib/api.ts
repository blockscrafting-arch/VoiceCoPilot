/**
 * API client for communicating with the backend server.
 * In production, API URL can be set at runtime via /config.json (generated from API_URL env in container).
 * In dev, use VITE_API_URL or default to http://127.0.0.1:8000. See docs/DEPLOY_WEB.md.
 */
const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
let _apiBaseUrl = DEFAULT_API_BASE_URL;
let _configLoaded = false;

/**
 * Load runtime config from /config.json (production). Call before first API use.
 */
export async function ensureConfigLoaded(): Promise<void> {
  if (_configLoaded) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`/config.json?v=${Date.now()}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json()) as { apiUrl?: string };
      if (j?.apiUrl && typeof j.apiUrl === "string") {
        let url = j.apiUrl.replace(/\/$/, "");
        // Avoid mixed content: if page is HTTPS, use HTTPS for API
        if (typeof window !== "undefined" && window.location?.protocol === "https:" && url.startsWith("http://")) {
          url = url.replace(/^http:\/\//i, "https://");
        }
        _apiBaseUrl = url;
      }
    }
  } catch {
    // No config, 404, timeout or network: keep default
  }
  _configLoaded = true;
}

function getApiBaseUrl(): string {
  return _apiBaseUrl;
}

/**
 * True if we're on a non-localhost origin but API URL is still localhost (config.json missing or API_URL not set).
 */
export function isProductionWithoutApiConfig(): boolean {
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;
  const isLocal =
    origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost");
  const apiIsLocal =
    _apiBaseUrl.startsWith("http://127.0.0.1") ||
    _apiBaseUrl.startsWith("http://localhost");
  return !isLocal && apiIsLocal;
}

const TOKEN_KEY = "voicecopilot_token";

function getToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "X-Project-Token": token } : {};
}

/**
 * Message in conversation history.
 */
interface Message {
  role: string;
  text: string;
}

/**
 * Project metadata.
 */
export interface Project {
  id: string;
  name: string;
  context_text: string;
  llm_model: string;
  created_at: string;
  updated_at: string;
  files: string[];
  token?: string | null;
}

/**
 * Generate suggestions based on conversation context.
 *
 * @param history - Recent conversation messages
 * @param context - Additional context
 * @param projectId - Optional project id
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Array of suggested responses
 */
export async function generateSuggestions(
  history: Message[],
  context: string = "",
  projectId?: string,
  signal?: AbortSignal
): Promise<string[]> {
  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7246/ingest/b61f59fc-c1a9-4f8c-ae0e-5d177a7f7853',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:25',message:'suggestions_fetch_start',data:{baseUrl:getApiBaseUrl(),projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  const response = await fetch(`${getApiBaseUrl()}/api/suggestions/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ history, context, project_id: projectId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.suggestions;
}

/**
 * Fetch all projects.
 */
export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return data.projects;
}

/**
 * Create a new project.
 */
export async function createProject(name: string): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Update project metadata or context.
 */
export async function updateProject(
  projectId: string,
  payload: Partial<Pick<Project, "name" | "context_text" | "llm_model">>
): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch a single project by id.
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Upload a context file to a project.
 */
export async function uploadContextFile(
  projectId: string,
  file: File,
  mode: "append" | "replace" = "append"
): Promise<Project> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const response = await fetch(
    `${getApiBaseUrl()}/api/projects/${projectId}/context/files`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
      body: formData,
    }
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * WebSocket connection manager for audio streaming.
 */
export class AudioWebSocket {
  private ws: WebSocket | null = null;
  private onTranscript: ((text: string, speaker: string) => void) | null = null;
  private onOpen: (() => void) | null = null;
  private onClose: (() => void) | null = null;
  private onError: ((error: Event) => void) | null = null;

  /**
   * Audio stream configuration.
   */
  private streamConfigs: Record<
    string,
    { sampleRate: number; channels: number; source?: string }
  > = {};

  /**
   * Encode ArrayBuffer to base64 string.
   */
  private static toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  /**
   * Connect to the audio streaming WebSocket.
   *
   * @param onTranscript - Callback for received transcriptions
   */
  connect(handlers: {
    onTranscript: (text: string, speaker: string) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Event) => void;
  }): void {
    const wsUrl = getApiBaseUrl().replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsUrl}/api/audio/stream`);
    this.onTranscript = handlers.onTranscript;
    this.onOpen = handlers.onOpen ?? null;
    this.onClose = handlers.onClose ?? null;
    this.onError = handlers.onError ?? null;

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      if (this.onOpen) {
        this.onOpen();
      }
      Object.entries(this.streamConfigs).forEach(([speaker, config]) => {
        this.sendConfig({ speaker, ...config });
      });
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "transcription" && this.onTranscript) {
        this.onTranscript(data.text, data.speaker);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (this.onError) {
        this.onError(error);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      if (this.onClose) {
        this.onClose();
      }
    };
  }

  /**
   * Send audio chunk to the server.
   *
   * @param audioData - Raw audio bytes
   */
  sendAudio(payload: { audioData: ArrayBuffer; speaker: string }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data = AudioWebSocket.toBase64(payload.audioData);
      this.ws.send(
        JSON.stringify({
          type: "audio",
          speaker: payload.speaker,
          data,
        })
      );
    }
  }

  /**
   * Send audio stream configuration.
   *
   * @param config - Sample rate and channels
   */
  sendConfig(config: {
    speaker: string;
    sampleRate: number;
    channels: number;
    projectId?: string;
    source?: string;
  }): void {
    this.streamConfigs[config.speaker] = {
      sampleRate: config.sampleRate,
      channels: config.channels,
      source: config.source,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "config",
          speaker: config.speaker,
          project_id: config.projectId,
          sample_rate: config.sampleRate,
          channels: config.channels,
          source: config.source,
        })
      );
    }
  }

  /**
   * Disconnect from the WebSocket.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
