# ADR-002: Фолбек getDisplayMedia для веб-захвата звука

**Статус**: Принято  
**Дата**: 2026-01-29

## Контекст

В веб-версии захват звука вкладки/экрана (собеседник) изначально делался только через browser extension (tabCapture). Без расширения пользователь не мог поделиться звуком созвона — UI не показывал диалог выбора экрана/вкладки.

## Решение

Добавить **фолбек на getDisplayMedia**: если расширение не установлено (страница не получает сообщение `ready` от content script), при «Начать эфир» вызывать `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`. Пользователь выбирает экран или вкладку; при включённом «Поделиться звуком вкладки» аудио идёт в тот же WebSocket API как `speaker: "other"`.

- Обнаружение расширения: content script при загрузке шлёт `{ source: "voicecopilot-extension", type: "ready" }`; UI слушает и выставляет `extensionAvailable`. При старте захвата: если `extensionAvailable` — extension flow, иначе getDisplayMedia.
- Формат аудио и конфига для «other» тот же (PCM16, onConfig один раз). Бэкенд не меняется.

## Последствия

- Работает без установки расширения (как в Google AI Studio: экран/вкладка + аудио).
- Истинный системный звук (вне браузера) по-прежнему только через extension/desktop; getDisplayMedia даёт только выбранный экран/вкладку/окно.

## Ссылки

- [Web Audio Extension Spec](../specs/web_audio_extension.md) — обновлён разделом Fallback without extension.
- [DEPLOY_WEB.md](../DEPLOY_WEB.md) — раздел Extension дополнен вариантом без расширения.
