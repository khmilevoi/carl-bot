import 'dotenv/config';

import { TelegramBot } from './bot/TelegramBot';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

const ai = new ChatGPTService(apiKey);
const storage = new SQLiteMemoryStorage();
const memories = new ChatMemoryManager(ai, storage, 20);

const bot = new TelegramBot(token, ai, memories);

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
