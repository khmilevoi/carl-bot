import 'dotenv/config';

import { TelegramBot } from './bot/TelegramBot';
import { JSONWhiteListChatFilter } from './services/ChatFilter';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import logger from './services/logger';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
const dbFileName = process.env.DB_FILE_NAME;

if (!token || !apiKey) {
  logger.error('BOT_TOKEN and OPENAI_API_KEY are required');
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

if (!dbFileName) {
  logger.error('DB_FILE_NAME is required');
  throw new Error('DB_FILE_NAME is required');
}

const ai = new ChatGPTService(apiKey, 'gpt-4o', 'gpt-4o-mini');
const storage = new SQLiteMemoryStorage(dbFileName);
const memories = new ChatMemoryManager(ai, storage, 50);
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
