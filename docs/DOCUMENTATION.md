# Документация VoiceCoPilot

Полное описание проекта: архитектура, компоненты, настройка, запуск и деплой.

---

## 1. Обзор

**VoiceCoPilot** — копайлот для голосовых звонков в реальном времени: захватывает микрофон и звук собеседника (система/вкладка), распознаёт речь и предлагает ИИ-подсказки, что сказать дальше.

### Основные возможности

- **Захват аудио**: микрофон пользователя; звук собеседника — через Windows WASAPI loopback (desktop), браузерное расширение (tabCapture) или getDisplayMedia (экран/вкладка в Web UI).
- **Распознавание речи (STT)**: faster-whisper локально или OpenAI Whisper API; опционально Web Speech API в браузере для микрофона.
- **Подсказки от ИИ**: контекстный ответ «что сказать» на основе последних реплик и контекста проекта (OpenRouter, по умолчанию Gemini).
- **Редактирование транскрипта**: правка сообщений по клику; исправленный текст используется при запросе подсказок.
- **Контекст предыдущих подсказок**: ИИ получает список уже выданных ответов и не повторяет их без необходимости.

### Варианты использования

- **Desktop (Tauri)**: нативное приложение с оверлеем, loopback системного звука.
- **Web**: SPA (Vite + React), деплой на Vercel/Railway; звук собеседника — расширение или шаринг экрана/вкладки.

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Клиент                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Tauri (desktop)│  │ Web (React)  │  │ Extension (Chrome)               │ │
│  │ WASAPI loopback│  │ getDisplayMedia│  │ tabCapture → postMessage → Web │ │
│  └───────┬──────┘  └───────┬──────┘  └──────────────┬───────────────────┘ │
│          │                  │                        │                     │
│          └──────────────────┼────────────────────────┘                     │
│                             │ WebSocket / REST                            │
└─────────────────────────────┼────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend (FastAPI)                                                       │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ /api/audio  │  │ Transcription   │  │ /api/suggestions│ │ LLMProvider │  │
│  │ WebSocket   │─▶│ (Whisper/OpenAI) │  │ POST /generate │─▶│ OpenRouter   │  │
│  └─────────────┘  └─────────────────┘  └──────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐                    │
│  │ /api/projects│  │ ProjectManager  │  │ DB + Storage  │                    │
│  │ /context    │─▶│ (CRUD, context) │─▶│ (SQLite/PG, S3)│                    │
│  └─────────────┘  └─────────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Клиент** отправляет аудио по WebSocket и конфиг (speaker, sample_rate, project_id); получает события `transcription` и использует REST для подсказок и проектов.
- **Backend** буферизует аудио, вызывает STT, фильтрует галлюцинации, отдаёт транскрипт; по запросу собирает историю и контекст проекта и вызывает LLM (с учётом предыдущих подсказок).

---

## 3. Структура проекта

```
VoiceCoPilot 2/
├── apps/
│   ├── api/                    # Backend (FastAPI)
│   │   ├── src/voicecopilot_api/
│   │   │   ├── main.py         # Точка входа, lifespan, роутеры
│   │   │   ├── config.py       # Pydantic Settings (env)
│   │   │   ├── logging_config.py
│   │   │   ├── models/         # Pydantic-схемы (schemas.py)
│   │   │   ├── routers/        # audio, health, projects, context, suggestions
│   │   │   └── services/       # transcription, llm_provider, project_manager, db, storage, file_parser, transcript_saver
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── .env.example
│   ├── web/                    # Фронтенд (React + Vite) и Tauri
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── components/     # Header, TranscriptPanel, SuggestionsPanel, Controls, ProjectSelector, ContextPanel
│   │   │   ├── hooks/          # useLiveStreaming, useAudioCapture
│   │   │   ├── stores/         # appStore, projectStore
│   │   │   ├── lib/            # api.ts, suggestionHistory.ts
│   │   │   └── services/       # speechRecognition (Web Speech API)
│   │   ├── src-tauri/          # Tauri 2 (Rust)
│   │   ├── Dockerfile          # Сборка веб-статистики для Railway
│   │   ├── docker-entrypoint.sh # Генерация config.json из API_URL
│   │   └── package.json
│   └── extension/              # Chrome-расширение для захвата звука вкладки
│       ├── manifest.json
│       ├── background.js
│       ├── content.js
│       ├── offscreen.html
│       └── offscreen.js
├── packages/
│   └── shared/                 # Общие типы/константы (TypeScript)
├── tests/                      # Python: unit, integration (conftest.py в корне)
│   ├── unit/
│   └── integration/
├── docs/
│   ├── DOCUMENTATION.md        # Этот файл
│   ├── SETUP.md                # Установка и запуск
│   ├── DEPLOY_WEB.md           # Деплой веб (Railway, Vercel)
│   ├── decisions/              # ADR (архитектурные решения)
│   └── specs/                  # Спеки (например web_audio_extension.md)
├── package.json                # Монорепо (pnpm), скрипты dev/build/test
├── pnpm-workspace.yaml
├── railway.json                # Конфиг Railway (build: Dockerfile apps/web)
├── .env.example
└── README.md
```

---

## 4. Технологический стек

| Слой | Технологии |
|------|-------------|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, Zustand |
| **Desktop** | Tauri 2, Rust (WASAPI/cpal для аудио) |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, WebSockets |
| **STT** | faster-whisper (локально), OpenAI Whisper API (опционально), Web Speech API (браузер, микрофон) |
| **LLM** | OpenRouter (клиент OpenAI-compatible), модели Gemini 2.x |
| **БД** | SQLAlchemy 2; SQLite локально, PostgreSQL на Railway |
| **Хранилище файлов** | S3-совместимое (boto3), опционально для контекста проектов |
| **Монорепо** | pnpm workspaces (`apps/*`, `packages/*`) |

---

## 5. Backend (API)

### 5.1 Конфигурация

Файл: `apps/api/src/voicecopilot_api/config.py`. Настройки через переменные окружения (и опционально `.env` в `apps/api`).

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `OPENROUTER_API_KEY` | Ключ OpenRouter | — |
| `LLM_MODEL` | Основная модель LLM | `google/gemini-2.0-flash-001` |
| `LLM_FALLBACK_MODEL` | Резервная модель | `google/gemini-2.5-flash` |
| `STT_PROVIDER` | `local` (faster-whisper) или `openai` | `local` |
| `STT_MODEL` | Модель Whisper при `local`: tiny, base, small, … | `base` |
| `STT_DEVICE` | При `local`: `cpu` или `cuda` | `cpu` |
| `OPENAI_API_KEY` | Ключ OpenAI при `STT_PROVIDER=openai` | — |
| `OPENAI_STT_MODEL` | Модель OpenAI STT | `gpt-4o-mini-transcribe` |
| `STT_CHUNK_SECONDS` | Длина буфера аудио (сек) для STT | `2.0` |
| `STT_SILENCE_RMS` | Порог RMS тишины (0 = выкл); ниже — не вызывать OpenAI | `300.0` |
| `API_HOST` / `API_PORT` | Хост и порт сервера | `127.0.0.1`, `8000` |
| `LOG_LEVEL` | Уровень логов | `INFO` |
| `DATABASE_URL` | Подключение к БД | `sqlite:///./voicecopilot.db` |
| `STORAGE_*` | S3-совместимое хранилище (bucket, region, keys, endpoint, public URL) | — |

### 5.2 Эндпоинты

- **GET /health** — статус API, `stt_provider`, `stt_chunk_seconds`, `openai_stt_model`.
- **GET /ready** — готовность к приёму запросов.
- **WebSocket /api/audio/stream** — поток аудио и транскрипций:
  - Клиент шлёт: `config` (speaker, sample_rate, channels, project_id, source), `audio` (base64 PCM), `client_transcript` (текст с клиента, например Web Speech API).
  - Сервер шлёт: `transcription` (text, is_final, speaker). В конце сессии транскрипт сохраняется через `transcript_saver`.
- **POST /api/suggestions/generate** — одна подсказка «что сказать»:
  - Body: `SuggestionRequest`: `history` (список Message), `context`, `project_id`, `previous_suggestions` (список строк).
  - Ответ: `SuggestionResponse`: `reply`.
  - Заголовок `X-Project-Token` для доступа к проекту и переопределения модели.
- **GET/POST /api/projects/** — список, создание, получение проектов.
- **PATCH /api/projects/{id}** — обновление name, context_text, llm_model.
- **POST /api/projects/{id}/context/files** — загрузка файла контекста (append/replace), парсинг (PDF, DOCX и т.д.).

### 5.3 Сервисы

- **TranscriptionService** (`services/transcription.py`): буфер по speaker, накопление до `stt_chunk_seconds`; при `openai` — проверка RMS тишины, вызов OpenAI Whisper API; при `local` — faster-whisper, ресемплинг до 16 kHz.
- **LLMProvider** (`services/llm_provider.py`): OpenRouter (AsyncOpenAI), системный промпт для одного ответа пользователя; в user content — контекст, блок «Ты уже предлагал…» (previous_suggestions), последние 6 сообщений диалога; fallback на вторую модель при ошибке.
- **ProjectManager** (`services/project_manager.py`): CRUD проектов по токену, контекст и список файлов в БД; вызов storage для файлов.
- **db, storage, file_parser, transcript_saver** — БД, S3, парсинг вложений, сохранение транскрипта по проекту.

### 5.4 Фильтрация транскрипта

В `routers/audio.py`: фразы-галлюцинации (титры, заставки) и дубликаты не отправляются клиенту и не пишутся в сохранённый транскрипт. Паттерны: «с вами был», «до скорой встречи», «спасибо за внимание», «редактор субтитров» и др. (см. ADR-003).

---

## 6. Frontend (Web)

### 6.1 Сборка и конфиг

- Разработка: `pnpm dev` (из корня — параллельно API и web) или `pnpm --filter @voicecopilot/web dev`.
- Продакшен: `pnpm --filter @voicecopilot/web build`. API URL в проде задаётся через `config.json`: при старте контейнера из `API_URL` генерируется `dist/config.json`; фронт запрашивает `/config.json` и использует `apiUrl` для REST и WebSocket. При открытой по HTTPS странице `http://` в конфиге подменяется на `https://`.

### 6.2 Состояние (Zustand)

- **appStore** (`stores/appStore.ts`):
  - Транскрипт: `transcript: Message[]` (role, text, isDraft); действия: addMessage, updateOrAppendDraft, finalizeDraft, appendToLastMessage, **editMessage(index, newText)**, clearTranscript.
  - Подсказки: `suggestions: SuggestionEntry[]` (id, status, text/error); addSuggestionRequest, setSuggestionResult.
  - Остальное: isConnected, isRecording, otherAudioSource, sttUserMode; setConnected, setRecording, setOtherAudioSource, setSttUserMode.
- **projectStore**: текущий проект (id, name, contextText, llm_model и т.д.), загрузка/создание/обновление через API.

### 6.3 Ключевые хуки и потоки

- **useLiveStreaming**: запуск/остановка захвата аудио, WebSocket, обработка транскрипций (мерж по окну, защита от эха, client_transcript при браузерной STT), ручной запрос подсказки.
  - При запросе подсказки: `buildSuggestionHistory(transcript)` (последние 6 не-draft сообщений, фильтр по длине и дубликатам), сбор `previousSuggestions` из завершённых подсказок (последние 10), вызов `generateReply(history, context, projectId, previousSuggestions)`.
- **useAudioCapture**: доступ к микрофону и (опционально) к источнику «other» — расширение (postMessage) или getDisplayMedia; отправка чанков в колбэк и конфиг в WebSocket.

### 6.4 Компоненты

- **Header**: заголовок приложения.
- **ProjectSelector**: выбор/создание проекта, отображение текущего.
- **ContextPanel**: отображение контекста проекта, загрузка файлов.
- **TranscriptPanel**: список сообщений, автоскролл; сообщения (не draft) редактируемые по клику (inline textarea, Enter/blur — сохранение, Escape — отмена).
- **SuggestionsPanel**: кнопка «Дать подсказку», список карточек подсказок (loading/done/error).
- **Controls**: старт/стоп эфира, очистка транскрипта, выбор режима STT микрофона (авто/браузер/сервер), индикатор источника «other» (расширение/display).

### 6.5 API-клиент (`lib/api.ts`)

- `ensureConfigLoaded()` — загрузка `/config.json` перед первым запросом.
- `generateReply(history, context, projectId?, previousSuggestions?, signal?)` — POST `/api/suggestions/generate`, body: history, context, project_id, previous_suggestions (если есть).
- Проекты: fetchProjects, createProject, updateProject, getProject, uploadContextFile.
- `AudioWebSocket`: connect, sendAudio, sendConfig, sendClientTranscript, disconnect.

### 6.6 История для подсказок (`lib/suggestionHistory.ts`)

- `buildSuggestionHistory(transcript)` — последние 6 не-draft сообщений, длина ≥ 12 символов, без подряд идущих дубликатов.
- `canRequestSuggestion(transcript)` — есть ли достаточно контента для запроса.

---

## 7. Расширение (Chrome)

- **Назначение**: захват звука вкладки (tabCapture) и передача в Web UI через `postMessage`.
- **Манифест**: Manifest V3, permissions: tabCapture, activeTab, scripting, storage; content script на все URL; background service worker.
- **Взаимодействие**: по каналу `source: "voicecopilot-extension"` / `"voicecopilot-web"` — события ready, audioChunk, status; команды startCapture (tab/system), stopCapture. Подробнее: `docs/specs/web_audio_extension.md`.

---

## 8. Desktop (Tauri)

- Приложение в `apps/web/src-tauri`: Rust (audio через WASAPI/cpal), UI — тот же React-билд. Запуск: `pnpm tauri dev` / `pnpm tauri build`. Сборка .exe: `apps/web/src-tauri/target/release/`.

---

## 9. Конфигурация окружения (сводка)

- **Корень / apps/api**: см. таблицу в разделе 5.1; дублирование в `.env.example` и `apps/api/.env.example`.
- **Веб (прод)**: переменная **API_URL** в сервисе Railway (или **VITE_API_URL** при сборке на Vercel) — URL API без завершающего слэша. Через `docker-entrypoint.sh` API_URL попадает в `dist/config.json`.

---

## 10. Установка и запуск

- Требования: Node.js 20+, pnpm 9+, Python 3.11+, Rust (для Tauri), при локальном STT — ffmpeg, опционально CUDA.
- Установка: клонирование, `pnpm install`, в `apps/api`: `python -m venv .venv`, активация, `pip install -r requirements.txt`. Скопировать `.env.example` в `.env`, задать `OPENROUTER_API_KEY` и при необходимости OpenAI/STT.
- Запуск API: `cd apps/api && python -m uvicorn voicecopilot_api.main:app --reload` (или через `pnpm dev:api` при наличии скрипта).
- Запуск фронта: `pnpm dev:web` или `pnpm --filter @voicecopilot/web dev`. Tauri: `cd apps/web && pnpm tauri dev`.
- Тесты: Python — `pytest tests -v` (из корня, с путём к `apps/api/src` при необходимости); фронт — `pnpm --filter @voicecopilot/web test`.

Подробнее: **docs/SETUP.md**.

---

## 11. Деплой

- **API (Railway)**: сервис из `apps/api` (Dockerfile), Postgres, переменные OPENROUTER_API_KEY, DATABASE_URL, STT_*, STORAGE_* и т.д. Домен в Settings → Networking.
- **Frontend (Railway)**: сборка из корня репозитория, Dockerfile `apps/web/Dockerfile`; переменная **API_URL**; entrypoint генерирует `dist/config.json`. Очистка build cache при отсутствии обновлений: Settings → Clear build cache → Redeploy.
- **Frontend (Vercel)**: **VITE_API_URL** при сборке.
- **Расширение**: установка из `apps/extension` (режим разработчика или упакованное расширение).

Подробнее: **docs/DEPLOY_WEB.md**.

---

## 12. Основные сценарии

1. **Транскрипция в реальном времени**: клиент подключается к WebSocket, шлёт config и audio (или client_transcript); сервер буферизует, вызывает STT, фильтрует и шлёт transcription; клиент обновляет transcript (draft/final, мерж по окну).
2. **Запрос подсказки**: пользователь нажимает «Дать подсказку»; из transcript строится history, из проектного контекста — context, из выполненных подсказок — previousSuggestions (последние 10); POST /api/suggestions/generate с project token; ответ отображается в SuggestionsPanel.
3. **Редактирование транскрипта**: клик по сообщению (не draft) → inline-редактор; Enter или blur → editMessage(index, text); при следующем запросе подсказки используется уже обновлённый transcript.

---

## 13. Решения и спецификации (ADR / Specs)

- **docs/decisions/001-audio-and-llm.md** — выбор аудио (WASAPI/cpal) и LLM/STT.
- **docs/decisions/002-web-getdisplaymedia-fallback.md** — fallback на getDisplayMedia в вебе.
- **docs/decisions/003-whisper-hallucination-filter.md** — фильтр галлюцинаций Whisper (титры, заставки).
- **docs/decisions/004-stt-model-and-silence-rms.md** — модель STT и порог тишины RMS.
- **docs/decisions/005-openrouter-models-research.md** — исследование моделей OpenRouter.
- **docs/specs/web_audio_extension.md** — спецификация расширения и протокол postMessage.

---

## 14. Устранение неполадок

- **Пустая транскрипция на Railway**: при `STT_PROVIDER=openai` обязательно задать `OPENAI_API_KEY`.
- **Фразы вроде «С вами был…» в транскрипте**: галлюцинации Whisper; на бэкенде отфильтровываются; при необходимости снизить чувствительность — `STT_SILENCE_RMS`, см. ADR-003, ADR-004.
- **WebSocket не подключается**: проверить, что API доступен по URL из config.json (и что страница по HTTPS не обращается к API по HTTP).
- **После деплоя не видны изменения**: очистить build cache веб-сервиса и пересобрать; обновить страницу с обходом кеша (Ctrl+F5 или ?v=1).

Дополнительно: раздел Troubleshooting в **docs/SETUP.md**.

---

## 15. Лицензия

MIT (см. README.md).
