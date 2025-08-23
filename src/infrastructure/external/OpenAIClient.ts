/* istanbul ignore file */
import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { OpenAIClient } from '@/application/interfaces/ai/OpenAIClient';
import {
  ENV_SERVICE_ID,
  type EnvService,
} from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { OpenAIRequest, OpenAIResponse } from '@/domain/ai/OpenAI';

@injectable()
export class OpenAIClientService implements OpenAIClient {
  private readonly openai: OpenAI;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.openai = new OpenAI({ apiKey: this.envService.env.OPENAI_KEY });
    this.logger = loggerFactory.create('OpenAIClientService');
  }

  public async processRequest(request: OpenAIRequest): Promise<OpenAIResponse> {
    const { model, messages } = request.body as {
      model: string;
      messages: ChatCompletionMessageParam[];
    };
    const completion = await this.openai.chat.completions.create({
      model,
      messages,
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? '';

    switch (request.type) {
      case 'generateMessage':
        return { type: 'generateMessage', body: content };
      case 'summarizeHistory':
        return { type: 'summarizeHistory', body: content };
      case 'checkInterest': {
        let parsed: { messageId: string; why: string } | null = null;
        try {
          parsed = JSON.parse(content);
        } catch (err) {
          this.logger.warn({ err, content }, 'Failed to parse checkInterest');
        }
        return { type: 'checkInterest', body: parsed };
      }
      case 'assessUsers': {
        let parsed: { username: string; attitude: string }[] = [];
        try {
          parsed = JSON.parse(content);
        } catch (err) {
          this.logger.warn({ err, content }, 'Failed to parse assessUsers');
        }
        return { type: 'assessUsers', body: parsed };
      }
    }
  }
}
