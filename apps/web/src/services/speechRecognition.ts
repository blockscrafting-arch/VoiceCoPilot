/**
 * Browser speech recognition (Web Speech API) for user mic channel.
 * Used when sttUserMode === 'browser' to avoid server STT and hallucinations.
 */

export type BrowserSpeechLang = "ru" | "en";

export interface BrowserSpeechCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

const LANG_MAP: Record<BrowserSpeechLang, string> = {
  ru: "ru-RU",
  en: "en-US",
};

export function isBrowserSpeechAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class BrowserSpeechService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private callbacks: BrowserSpeechCallbacks | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private lang: BrowserSpeechLang = "ru";

  constructor() {
    if (!isBrowserSpeechAvailable()) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    this.recognition = new Ctor() as SpeechRecognition;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = LANG_MAP.ru;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = (result[0] as SpeechRecognitionAlternative)?.transcript ?? "";
        if (result.isFinal) {
          finalText += transcript + " ";
        } else {
          interimText += transcript;
        }
      }
      if (this.callbacks) {
        this.callbacks.onResult(
          (finalText || interimText).trim(),
          !!finalText
        );
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      if (this.isListening && this.recognition) {
        this.restartTimer = setTimeout(() => {
          try {
            this.recognition?.start();
          } catch {
            // already started
          }
        }, 100);
      }
    };
  }

  setLanguage(lang: BrowserSpeechLang): void {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = LANG_MAP[lang];
      if (this.isListening) {
        this.stop();
        setTimeout(() => {
          if (this.callbacks) this.start(this.callbacks);
        }, 200);
      }
    }
  }

  start(callbacks: BrowserSpeechCallbacks): void {
    if (!this.recognition) return;
    this.callbacks = callbacks;
    this.recognition.lang = LANG_MAP[this.lang];
    this.isListening = true;
    try {
      this.recognition.start();
    } catch {
      // already started
    }
  }

  stop(): void {
    this.isListening = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
  }
}
