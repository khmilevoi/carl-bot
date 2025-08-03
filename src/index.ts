import 'dotenv/config';

import { TelegramBot } from '@/bot/TelegramBot';
import container from '@/container';
import logger from '@/services/logging/logger';

async function main() {
  const bot = await container.getAsync<TelegramBot>(TelegramBot);

  logger.info('Starting application');
  await bot.launch();

  process.once('SIGINT', () => {
    logger.info('SIGINT received');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    logger.info('SIGTERM received');
    bot.stop('SIGTERM');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start application');
  process.exit(1);
});
