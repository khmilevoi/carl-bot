import 'dotenv/config';

import { TelegramBot } from './bot/TelegramBot';
import container from './container';
import { SERVICE_ID } from './services/identifiers';
import logger from './services/logging/logger';

const bot = container.get<TelegramBot>(SERVICE_ID.TelegramBot);

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
