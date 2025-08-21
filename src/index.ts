import http from 'node:http';

import type { EnvService } from './application/use-cases/env/EnvService';
import { ENV_SERVICE_ID } from './application/use-cases/env/EnvService';
import { PinoLoggerFactory } from './application/use-cases/logging/LoggerFactory';
import { TelegramBot } from './bot/TelegramBot';
import { container } from './container';

const envService = container.get<EnvService>(ENV_SERVICE_ID);
const loggerFactory = new PinoLoggerFactory(envService);
const logger = loggerFactory.create('index');
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
