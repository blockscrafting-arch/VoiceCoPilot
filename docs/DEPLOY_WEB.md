## Веб деплой (cloud)

### Backend (Railway)
1) Создай новый проект на Railway.
2) Выбери папку `apps/api`.
3) Укажи переменные окружения:
   - `OPENROUTER_API_KEY`
   - `DATABASE_URL`
   - `STORAGE_BUCKET`
   - `STORAGE_REGION`
   - `STORAGE_ENDPOINT_URL` (если не AWS)
   - `STORAGE_ACCESS_KEY`
   - `STORAGE_SECRET_KEY`
   - `STORAGE_PUBLIC_BASE_URL` (если нужен публичный URL файлов)
4) Проверка: `/health` возвращает 200.

### Frontend (Vercel)
1) Импортируй репозиторий.
2) Выбери проект `apps/web`.
3) Укажи переменную `VITE_API_URL` (URL Railway).
4) Проверка: UI открывается, запросы уходят на API.

### Extension
1) Установи расширение из `apps/extension`.
2) Открой Web UI, нажми старт.
3) Проверь, что транскрипция идет по звуку вкладки.
