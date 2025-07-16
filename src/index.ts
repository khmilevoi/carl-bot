import 'dotenv/config';

import { TelegramClientApp } from './client/TelegramClient';
import { JSONWhiteListChatFilter } from './services/ChatFilter';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import logger from './services/logger';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';

const apiId = process.env.TG_API_ID;
const apiHash = process.env.TG_API_HASH;
const session = process.env.TG_SESSION;
const apiKey = process.env.OPENAI_API_KEY;

if (!apiId || !apiHash || !session || !apiKey) {
  logger.error(
    'TG_API_ID, TG_API_HASH, TG_SESSION and OPENAI_API_KEY are required'
  );
  throw new Error(
    'TG_API_ID, TG_API_HASH, TG_SESSION and OPENAI_API_KEY are required'
  );
}

const ai = new ChatGPTService(apiKey);
const storage = new SQLiteMemoryStorage();
const memories = new ChatMemoryManager(ai, storage, 100);
const filter = new JSONWhiteListChatFilter('white_list.json');

const client = new TelegramClientApp(
  Number(apiId),
  apiHash,
  session,
  ai,
  memories,
  filter
);

logger.info('Starting application');
client.launch();

process.once('SIGINT', () => {
  logger.info('SIGINT received');
  client.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('SIGTERM received');
  client.stop('SIGTERM');
});
