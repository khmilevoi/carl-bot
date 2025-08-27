import http from 'node:http';

import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from './application/interfaces/logging/LoggerFactory';
import { container } from './container';
import { MainService } from './view/telegram/MainService';

const loggerFactory = container.get<LoggerFactory>(LOGGER_FACTORY_ID);
const logger = loggerFactory.create('index');
const main = container.get<MainService>(MainService);

logger.info('Starting application');
void main.launch();

http
  .createServer((_, res) => {
    res.writeHead(200);
    res.end('ok');
  })
  .listen(3000, () => logger.info('HTTP server listening on port 3000'));

process.once('SIGINT', () => {
  logger.info('SIGINT received');
  main.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('SIGTERM received');
  main.stop('SIGTERM');
});
