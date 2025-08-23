/* eslint-disable import/no-unused-modules */
import 'reflect-metadata';

import { Container } from 'inversify';

import { AI_SERVICE_ID } from '@/application/interfaces/ai/AIService';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import {
  RABBITMQ_SERVICE_ID,
  type RabbitMQService,
} from '@/application/interfaces/queue/RabbitMQService';
import { register } from '@/container/application';
import type { OpenAIRequest } from '@/domain/ai/OpenAI';
import type { ChatGPTService } from '@/infrastructure/external/ChatGPTService';

const container = new Container();
register(container);

const rabbit = container.get<RabbitMQService>(RABBITMQ_SERVICE_ID);
const chatgpt = container.get<ChatGPTService>(
  AI_SERVICE_ID as unknown as symbol
);
const loggerFactory = container.get<LoggerFactory>(LOGGER_FACTORY_ID);
const logger = loggerFactory.create('OpenAIWorker');

const MAX_RETRIES = 5;

void (async () => {
  await rabbit.consume(async (msg, priority) => {
    const request = JSON.parse(msg) as OpenAIRequest & { attempt?: number };
    const attempt = request.attempt ?? 0;
    try {
      await chatgpt.processRequest(request);
      logger.debug({ type: request.type }, 'Processed OpenAI request');
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        logger.error({ err, attempt }, 'Failed to process request, retrying');
        setTimeout(() => {
          void rabbit.publish(
            JSON.stringify({ ...request, attempt: attempt + 1 }),
            priority
          );
        }, delay);
      } else {
        logger.error({ err }, 'Giving up on request');
      }
    }
  });
})();
