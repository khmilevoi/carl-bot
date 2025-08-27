import http from 'node:http';

import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from './application/interfaces/logging/LoggerFactory';
import {
  TOPIC_OF_DAY_SCHEDULER_ID,
  type TopicOfDayScheduler,
} from './application/interfaces/scheduler/TopicOfDayScheduler';
import { container } from './container';
import { TelegramBot } from './view/telegram/TelegramBot';

const loggerFactory = container.get<LoggerFactory>(LOGGER_FACTORY_ID);
const logger = loggerFactory.create('index');
const bot = container.get<TelegramBot>(TelegramBot);
const scheduler = container.get<TopicOfDayScheduler>(TOPIC_OF_DAY_SCHEDULER_ID);

logger.info('Starting application');
bot.launch();
void scheduler.start();

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
