## Веб деплой (cloud)

### Backend (Railway)
1) Создай новый проект на Railway.
2) Выбери папку `apps/api`.
3) Добавь сервис **Postgres** (Railway подставит `DATABASE_URL`). Драйвер `psycopg2-binary` уже в `requirements.txt`.
4) Укажи остальные переменные окружения:
   - `OPENROUTER_API_KEY`
   - `DATABASE_URL` (подставляется при добавлении Postgres)
   - `STT_MODEL=tiny` — для веб‑демо рекомендуется (быстрее первая транскрибация, меньше задержка; качество ниже, чем у `base`).
   - `STORAGE_BUCKET`
   - `STORAGE_REGION`
   - `STORAGE_ENDPOINT_URL` (если не AWS)
   - `STORAGE_ACCESS_KEY`
   - `STORAGE_SECRET_KEY`
   - `STORAGE_PUBLIC_BASE_URL` (если нужен публичный URL файлов)
5) Проверка: сгенерируй домен для API (Settings → Networking → Generate Domain), затем `GET https://<твой-api>.up.railway.app/health` возвращает 200.

### Frontend

**Без URL бэкенда проекты, транскрипция и подсказки не работают** — UI будет загружаться, но запросы уйдут на localhost и вернут ошибку.

**Вариант A: Frontend на Railway (Docker)**  
В настройках сервиса web задай переменную окружения **`API_URL`** = публичный URL API **по HTTPS** и без слэша в конце (например `https://<твой-api>.up.railway.app`). Иначе браузер заблокирует запросы (mixed content: страница по HTTPS, API по HTTP). При старте контейнера из `API_URL` генерируется `dist/config.json`; фронт запрашивает `/config.json` и подставляет этот URL для REST и WebSocket. Если в конфиге указан `http://`, фронт при открытой по HTTPS странице автоматически подменяет на `https://`. Пересборка при смене URL не нужна.

**Вариант B: Frontend на Vercel**  
В настройках проекта укажи **`VITE_API_URL`** = URL API (см. выше). Vite подставит его при сборке. Проверка: UI открывается, запросы уходят на API.

### Extension (опционально)
1) Установи расширение из `apps/extension` для захвата звука вкладки через tabCapture.
2) Открой Web UI, нажми старт.
3) Проверь, что транскрипция идёт по звуку вкладки.

**Без расширения:** при «Начать эфир» браузер предложит выбрать экран или вкладку с включённым звуком (getDisplayMedia). Выбери вкладку с созвоном и включи «Поделиться звуком вкладки» — транскрипция пойдёт так же.
