# arkadius-bot

Telegram bot "Аркадий" written in TypeScript. It replies when tagged or when users reply to its messages. Uses OpenAI's ChatGPT 4o.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Create `.env` with Telegram and OpenAI tokens:
   ```
   BOT_TOKEN=your-telegram-token
   OPENAI_API_KEY=your-openai-key
   ```
3. Run in development
   ```bash
   npx ts-node src/index.ts
   ```
4. Build
   ```bash
   npx tsc
   ```

