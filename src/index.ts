import http from 'node:http';

import { TelegramBot } from './bot/TelegramBot';
import { container } from './container';
import { PinoLogger } from './services/logging/PinoLogger';

const logger = new PinoLogger();
const bot = container.get<TelegramBot>(TelegramBot);

logger.info('Starting application');
bot.launch();

http
  .createServer((_, res) => {
    res.writeHead(200);
    res.end('ok');
  })
  .listen(3000, () => logger.info('HTTP server listening on port 3000'));

process.once('SIGINT', () => {
  logger.info('SIGINT received');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('SIGTERM received');
  bot.stop('SIGTERM');
});
