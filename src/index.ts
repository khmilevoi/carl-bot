import 'dotenv/config';

import { TelegramBot } from './bot/TelegramBot';
import { JSONWhiteListChatFilter } from './services/ChatFilter';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import logger from './services/logger';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
if (!token || !apiKey) {
  logger.error('BOT_TOKEN and OPENAI_API_KEY are required');
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

const ai = new ChatGPTService(apiKey, 'o3', 'gpt-4o-mini');
const storage = new SQLiteMemoryStorage();
const memories = new ChatMemoryManager(ai, storage, 5);
const filter = new JSONWhiteListChatFilter('white_list.json');

const bot = new TelegramBot(token, ai, memories, filter);

logger.info('Starting application');
bot.launch();

process.once('SIGINT', () => {
  logger.info('SIGINT received');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('SIGTERM received');
  bot.stop('SIGTERM');
});
