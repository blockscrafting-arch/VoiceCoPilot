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

### API сервер

1. Создайте проект на [railway.app](https://railway.app)
2. Подключите GitHub репозиторий
3. Укажите корневую директорию: `apps/api`
4. Добавьте переменные окружения:
   - `OPENROUTER_API_KEY`
   - `LOG_LEVEL=INFO`
5. Деплой запустится автоматически

### Переменные окружения Railway

| Переменная | Описание |
|------------|----------|
| `OPENROUTER_API_KEY` | API ключ OpenRouter |
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
