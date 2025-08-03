# arkadius-bot

Карл — Telegram бот, написанный на TypeScript. Он использует ChatGPT 4o и отвечает в групповых чатах при упоминании или ответе на его сообщение.

## Возможности

- Команда `/start` выводит приветствие.
- `/ping` просто отвечает `pong`.
- `/reset` сбрасывает память диалога.
- `/dump` запрашивает секретный ключ и отправляет CSV-файлы всех таблиц.
- Откликается, если его упомянут, ответят на сообщение бота или начнут сообщение с имени Карл.
- Может откликаться на ключевые слова из `keywords.json`.
- Запоминает предыдущие сообщения в SQLite и суммирует длинные чаты для сохранения контекста.
- Персона бота описана в `persona.md`.

## Установка

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Создайте `.env` с токенами Telegram и OpenAI и при необходимости настройте дополнительные параметры:
   ```
   BOT_TOKEN=your-telegram-token
   OPENAI_API_KEY=your-openai-key
   LOG_PROMPTS=false            # сохранять ли промпты в prompts.log
   CHAT_HISTORY_LIMIT=50        # сколько сообщений хранить до суммаризации
   DB_EXPORT_KEY=your-secret     # ключ для выгрузки данных
   ```
3. Запустите в режиме разработки:
   ```bash
   npm run dev
   ```
4. Соберите проект:
   ```bash
   npm run build
   ```
5. Примените миграции БД:
   ```bash
   npm run migration:up
   ```
   Если файл `memory.db` уже существует и не содержит таблицу `migrations`,
   скрипт автоматически удалит его перед применением миграций.
6. Запустите собранную версию:
   ```bash
   npm start
   ```

Для проверки типов и тестов можно выполнить:

```bash
npm run type:check
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run lint:fix
npm run format
npm run format:fix
npm run migration:check
```

## Структура проекта

- `src/index.ts` — точка входа приложения.
- `src/bot/TelegramBot.ts` — логика бота и обработка сообщений.
- `src/services/ai/ChatGPTService.ts` — взаимодействие c OpenAI.
- `src/services/chat/ChatMemory.ts` — хранение истории и ее суммаризация.
- `dist/` — собранные файлы.

Репозиторий полностью базируется на npm и TypeScript.
