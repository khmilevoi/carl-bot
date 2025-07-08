# arkadius-bot

A Telegram bot named "Аркадий" written in TypeScript. It integrates OpenAI's ChatGPT&nbsp;4o and replies in group chats when you mention it or reply to one of its messages.

## Features

- Responds to the `/start` command with a greeting.
- Listens for mentions of `@<botname>` in messages.
- Detects replies to messages sent by the bot.
- Sends the message text to ChatGPT&nbsp;4o and posts the response back.

## Setup

1. Install dependencies using **pnpm**:
   ```bash
   pnpm install
   ```
2. Create a `.env` file with tokens for Telegram and OpenAI:
   ```
   BOT_TOKEN=your-telegram-token
   OPENAI_API_KEY=your-openai-key
   ```
3. Run in development mode:
   ```bash
   pnpm exec ts-node src/index.ts
   ```
4. Build the project:
   ```bash
   pnpm run build
   ```
5. Start the compiled bot:
   ```bash
   pnpm start
   ```

## Project structure

- `src/index.ts` – bot entry point using Telegraf.
- `src/chatgpt.ts` – helper functions for working with the OpenAI API.
- `dist/` – compiled output after running the build.

The repository uses pnpm and TypeScript. Run `pnpm exec tsc` to ensure the
project compiles without errors.
