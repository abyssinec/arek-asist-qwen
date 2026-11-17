# AREK Asist + Qwen

AI-консультант АО «Астана-РЭК» для вертикального сенсорного киоска 1080×1920.

Сайт: [astrec-gid.pages.dev](https://astrec-gid.pages.dev/). Репозиторий приватный.

## Возможности

- Четыре экрана: заставка, AI-консультант, документы и лицевой счёт.
- Русский, казахский и английский интерфейс.
- Голосовой ввод, экранная клавиатура, быстрые темы и анимированный бот.
- Qwen `qwen3.8-omni-flash-realtime` для распознавания, выбора ответа и озвучки Tina.
- Карточки услуг, списки документов, макеты термочека и выписки A4.
- Таймаут и сброс сессии, отдельный адаптер Device Bridge.

Биллинг, оборудование и печать в опубликованной версии демонстрационные. База компании — снимок от 06.10.2026: 103 темы и 46 контактов.

## Устройство проекта

`frontend/` — React 19, TypeScript 7, Vite 8, Motion 14. Сцена масштабируется под окно браузера. API подключается через `KioskApi`.

`backend/` — Node-адаптер и Cloudflare Pages Worker. Общие сценарии: `get_company_answer`, `show_documents`, `open_account`, `guide_reply`. Аргументы проверяются сервером; действия возвращают штатные карточки фронта.

`data/knowledge/` — исходные TXT/CSV. `design/kiosk-prototype/` — макеты экранов. [Старая памятка передачи](docs/HANDOVER.md) сохранена из исходного проекта.

## Запуск

Нужны Node.js `^20.19.0` или `>=22.12.0` и npm. Проверенная версия — Node 24.

```powershell
npm --prefix frontend ci
npm --prefix backend ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env.local
```

Заполните серверный `.env.local` по примеру. Для включения Qwen в `frontend/.env.local`:

```dotenv
VITE_QWEN_ENABLED=true
VITE_QWEN_API_URL=/qwen-api
VITE_TTS_ENABLED=true
VITE_USE_MOCKS=true
```

В двух терминалах из корня проекта:

```powershell
npm --prefix backend start
npm --prefix frontend run dev
```

Frontend: `http://127.0.0.1:5173/`. Backend: `http://127.0.0.1:8789/api/health`. Vite проксирует `/qwen-api` на Node `/api`.

Для автономной демонстрации выключить `VITE_QWEN_ENABLED`. Остальные сервисы выбираются независимо через `VITE_USE_MOCKS`. Отдельный `vite preview` AI-прокси не запускает.

## Голос

MediaRecorder → PCM 16 кГц → Omni STT → chat → Tina PCM16 LE mono 24 кГц. Озвучка воспроизводится по мере поступления. На TTS один запрос, без повторной генерации. История остаётся на странице и не отправляется Qwen; для каждого вызова открывается отдельный WebSocket с закрытием после результата или отмены.

Язык вопроса определяет язык ответа; при неопределённости используется язык интерфейса. Выходной AudioContext разблокируется при нажатии и сохраняется на время ожидания ответа. Турецкая транслитерация в рабочую озвучку не включена.

## API Qwen

| Маршрут | Назначение |
|---|---|
| `GET /qwen-api/health` | Состояние AI-адаптера |
| `POST /qwen-api/ai/stt` | `{audio,lang}`, base64 PCM 16 кГц → текст |
| `POST /qwen-api/ai/chat` | `{text,lang,sessionId,kioskId}` → ответ, язык и карточки |
| `POST /qwen-api/ai/tts-stream` | `{text,lang,voiceToken}` → PCM 24 кГц |
| `POST /qwen-api/ai/tts` | Совместимая озвучка WAV |

Локальный Node использует префикс `/api`. Контракты фронта — `frontend/src/api/types.ts`.

## Проверки и сборка

```powershell
npm --prefix backend test
npm --prefix frontend run typecheck
node backend/build-pages.mjs
```

В backend 33 проверки: функции, карточки на трёх языках, языковой приоритет, PCM, поток, отмена и AudioContext. `check-live.mjs`, `check-stt.mjs`, `check-stream.mjs` обращаются к реальному Qwen; `TEST_BASE` выбирает адрес API.

## Cloudflare Pages

`wrangler.jsonc` задаёт проект `astrec-gid`, `nodejs_compat` и `frontend/dist`. Сначала выполните сборку выше, затем:

```powershell
npx wrangler@4.147.0 pages deploy frontend/dist --project-name astrec-gid --branch main
```

Параметры окружения задаются в Cloudflare. Сборка включает Qwen/TTS и сохраняет моки биллинга, контента и печати. Свой домен автоматически не подключается.
