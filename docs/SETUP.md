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

| Переменная | Описание |
|------------|----------|
| `OPENROUTER_API_KEY` | API ключ OpenRouter |
| `DATABASE_URL` | URL БД (локально SQLite; на Railway — Postgres, подставляется при добавлении сервиса) |
| `LLM_MODEL` | Модель по умолчанию |
| `LOG_LEVEL` | Уровень логирования |

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

### Ошибка CUDA
Если нет GPU, используйте CPU:
```env
STT_DEVICE=cpu
```

### WebSocket не подключается
Проверьте, что API сервер запущен и доступен по адресу в `.env`.
