import 'dotenv/config';

import { TelegramBot } from '@/bot/TelegramBot';
import container from '@/container';
import logger from '@/services/logging/logger';

const bot = container.get<TelegramBot>(TelegramBot);

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
