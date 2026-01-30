# VoiceCoPilot — Руководство по установке

## Требования

### Для разработки
- **Node.js** 20+ и **pnpm** 9+
- **Python** 3.11+
- **Rust** (для сборки Tauri)
- **Visual Studio Build Tools** (Windows) — для компиляции Rust

### Для работы STT (локально)
- **ffmpeg** (для обработки аудио)
- GPU с CUDA (опционально, для ускорения Whisper)

## Установка

### 1. Клонирование и зависимости

```bash
git clone <repository-url>
cd VoiceCoPilot

# Node зависимости
pnpm install

# Python виртуальное окружение
cd apps/api
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
cd ../..
```

### 2. Настройка окружения

```bash
# Скопировать пример конфигурации
cp .env.example .env
```

Отредактируйте `.env`:

```env
# Обязательно — ключ OpenRouter
OPENROUTER_API_KEY=sk-or-v1-ваш-ключ

# Опционально — модели
LLM_MODEL=google/gemini-2.0-flash-001
LLM_FALLBACK_MODEL=google/gemini-2.5-flash

# STT настройки
STT_MODEL=base  # tiny, base, small, medium, large
STT_DEVICE=cpu  # или cuda для GPU
```

### 3. Получение ключа OpenRouter

1. Зайдите на [openrouter.ai](https://openrouter.ai)
2. Создайте аккаунт
3. Перейдите в Settings → Keys
4. Создайте новый ключ
5. Скопируйте в `.env`

## Запуск

### Разработка

```bash
# Запустить API сервер
cd apps/api
python -m uvicorn voicecopilot_api.main:app --reload

# В другом терминале — фронтенд
cd apps/web
pnpm dev

# Или Tauri приложение (требуется Rust)
pnpm tauri dev
```

### Тесты

```bash
# Python тесты
cd apps/api
pytest ../tests -v

# Frontend тесты
cd apps/web
pnpm test
```

## Деплой на Railway

Полный веб-деплой (API + фронт + переменные) описан в [DEPLOY_WEB.md](DEPLOY_WEB.md).

### API сервер (кратко)

1. Создайте проект на [railway.app](https://railway.app)
2. Подключите GitHub репозиторий
3. Соберите из `apps/api` (Dockerfile или Nixpacks)
4. Добавьте сервис Postgres в проект (Railway подставит `DATABASE_URL`); драйвер `psycopg2-binary` в `requirements.txt`.
5. Добавьте переменные окружения:
   - `OPENROUTER_API_KEY` (обязательно)
   - `DATABASE_URL` (подставляется при добавлении Postgres)
   - `LOG_LEVEL=INFO`
   - для файлового контекста: `STORAGE_*` (см. DEPLOY_WEB.md)
6. Сгенерируйте домен для API (Settings → Networking → Generate Domain). Проверка: `GET https://<ваш-api>.up.railway.app/health` возвращает 200.

### Переменные окружения Railway (API)

**Важно:** STT и LLM настраиваются **только в API‑сервисе** (Railway Variables у сервиса с Dockerfile из `apps/api`). Веб‑сервис (фронт) не читает STT/LLM переменные — он лишь обращается к API по URL из `config.json`.

| Переменная | Описание |
|------------|----------|
| `OPENROUTER_API_KEY` | API ключ OpenRouter |
| `DATABASE_URL` | URL БД (локально SQLite; на Railway — Postgres, подставляется при добавлении сервиса) |
| `LLM_MODEL` | Модель по умолчанию |
| `STT_PROVIDER` | `local` (faster-whisper) или `openai` (Whisper API) |
| `STT_MODEL` | Модель Whisper **только при STT_PROVIDER=local**: `tiny`, `base`, `small`, … |
| `STT_DEVICE` | **Только при STT_PROVIDER=local**: `cpu` или `cuda` |
| `OPENAI_API_KEY` | Ключ OpenAI при STT_PROVIDER=openai |
| `OPENAI_STT_MODEL` | Модель OpenAI STT: `gpt-4o-mini-transcribe` (по умолчанию), `gpt-4o-transcribe` (точнее), `gpt-4o-transcribe-diarize` (разделение спикеров; формат ответа может отличаться — см. документацию OpenAI), `whisper-1` (legacy) |
| `STT_CHUNK_SECONDS` | Длина буфера аудио в сек (для openai, напр. 1.0–1.5, меньше = быстрее ответ) |
| `STT_SILENCE_RMS` | Порог RMS тишины (0 = выкл): если RMS чанка ниже порога, OpenAI не вызывается (200–400 типично) |
| `LOG_LEVEL` | Уровень логирования |

### Транскрипция микрофона: браузер или сервер

В веб-приложении можно выбрать способ распознавания **микрофона** (канал «Вы»):

- **Браузер (Chrome)** — используется Web Speech API в браузере; аудио микрофона не отправляется на сервер, распознавание идёт в Chrome/Edge. Нет галлюцинаций и лишних вызовов OpenAI для вашей речи. Рекомендуется, если браузер поддерживает (Chrome, Edge).
- **Сервер** — микрофон отправляется на API, транскрипция через OpenAI (как канал «Собеседник»). Переключатель «Микрофон: браузер / сервер» отображается в панели управления при поддержке Web Speech API.

### Режим «Один спикер»

Если включён чекбокс **Один спикер** в панели управления, приложение **не захватывает** системный звук и звук из расширения (канал «Собеседник»). Транскрибируется только микрофон; подсказки строятся только по вашей речи. Режим полезен, когда вы говорите один (презентация, заметки), чтобы избежать лишних фрагментов «Собеседник» и нерелевантных подсказок.

## Сборка desktop-приложения

```bash
cd apps/web

# Development build
pnpm tauri dev

# Production build
pnpm tauri build
```

Готовый `.exe` будет в `apps/web/src-tauri/target/release/`.

## Troubleshooting

### Whisper не загружается
```bash
# Установите ffmpeg
# Windows (через chocolatey)
choco install ffmpeg

# Или скачайте с ffmpeg.org
```

### Транскрипция пустая на Railway
Если используете `STT_PROVIDER=openai`, в Railway Variables обязательно задайте `OPENAI_API_KEY` (ключ OpenAI). Без него транскрипция возвращает пустой текст и в логах при старте будет предупреждение. При `STT_PROVIDER=openai` переменные `STT_MODEL` и `STT_DEVICE` не используются — STT идёт через API OpenAI.

### В транскрипте фразы «С вами был…», «До скорой встречи», «Спасибо за внимание!»
Это **галлюцинации Whisper**: на тишине или коротких чанках модель иногда «додумывает» типичные заставки/титры, которых в аудио нет. На бэкенде такие фразы отфильтровываются и не показываются в UI. Для снижения галлюцинаций используйте `OPENAI_STT_MODEL=gpt-4o-mini-transcribe` и `STT_SILENCE_RMS=200–400`. Подробнее: [003-whisper-hallucination-filter.md](decisions/003-whisper-hallucination-filter.md), [004-stt-model-and-silence-rms.md](decisions/004-stt-model-and-silence-rms.md).

### Ошибка CUDA
Если нет GPU, используйте CPU:
```env
STT_DEVICE=cpu
```

### WebSocket не подключается
Проверьте, что API сервер запущен и доступен по адресу в `.env`.
