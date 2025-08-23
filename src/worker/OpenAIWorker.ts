/* istanbul ignore file */
/* eslint-disable import/no-unused-modules */
import 'reflect-metadata';

import { Container } from 'inversify';

import {
  OPENAI_CLIENT_ID,
  type OpenAIClient,
} from '@/application/interfaces/ai/OpenAIClient';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import {
  RABBITMQ_SERVICE_ID,
  type RabbitMQService,
} from '@/application/interfaces/queue/RabbitMQService';
import { register } from '@/container/application';
import {
  type OpenAIRequest,
  openAIRequestSchema,
  type OpenAIResponse,
} from '@/domain/ai/OpenAI';
import { sleep } from '@/utils/sleep';

const container = new Container();
register(container);

const rabbit = container.get<RabbitMQService>(RABBITMQ_SERVICE_ID);
const openai = container.get<OpenAIClient>(OPENAI_CLIENT_ID);
const loggerFactory = container.get<LoggerFactory>(LOGGER_FACTORY_ID);
const logger = loggerFactory.create('OpenAIWorker');

const MAX_RETRIES = 5;

void (async () => {
  await rabbit.consumeRpc<OpenAIRequest, OpenAIResponse>(
    openAIRequestSchema,
    async (request, _priority) => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await openai.processRequest(request);
          logger.debug({ type: request.type }, 'Processed OpenAI request');
          return response;
        } catch (err) {
          const delay = Math.min(1000 * 2 ** attempt, 30000);
          logger.error({ err, attempt }, 'Failed to process request, retrying');
          if (attempt < MAX_RETRIES - 1) {
            await sleep(delay);
          } else {
            logger.error({ err }, 'Giving up on request');
            switch (request.type) {
              case 'checkInterest':
                return { type: 'checkInterest', body: null };
              case 'assessUsers':
                return { type: 'assessUsers', body: [] };
              default:
                return { type: request.type, body: '' } as OpenAIResponse;
            }
          }
        }
      }
      switch (request.type) {
        case 'checkInterest':
          return { type: 'checkInterest', body: null };
        case 'assessUsers':
          return { type: 'assessUsers', body: [] };
        default:
          return { type: request.type, body: '' } as OpenAIResponse;
      }
    }
  );
})();
