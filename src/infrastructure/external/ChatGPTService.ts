import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ChatModel } from 'openai/resources/shared';
import path from 'path';

import type { AIService } from '@/application/interfaces/ai/AIService';
import type { EnvService } from '@/application/interfaces/env/EnvService';
import { ENV_SERVICE_ID } from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { PromptService } from '@/application/interfaces/prompts/PromptService';
import { PROMPT_SERVICE_ID } from '@/application/interfaces/prompts/PromptService';
import type { RabbitMQService } from '@/application/interfaces/queue/RabbitMQService';
import { RABBITMQ_SERVICE_ID } from '@/application/interfaces/queue/RabbitMQService';
import {
  OPENAI_REQUEST_PRIORITY,
  type OpenAIRequest,
} from '@/domain/ai/OpenAI';
import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { TriggerReason } from '@/domain/triggers/Trigger';

@injectable()
export class ChatGPTService implements AIService {
  private readonly askModel: ChatModel;
  private readonly summaryModel: ChatModel;
  private readonly interestModel: ChatModel;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService,
    @inject(PROMPT_SERVICE_ID) private readonly prompts: PromptService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory,
    @inject(RABBITMQ_SERVICE_ID) private readonly rabbit: RabbitMQService
  ) {
    const models = this.envService.getModels();
    this.askModel = models.ask;
    this.summaryModel = models.summary;
    this.interestModel = models.interest;
    this.logger = this.loggerFactory.create('ChatGPTService');
    this.logger.debug('ChatGPTService initialized');
  }

  public async ask(
    history: ChatMessage[],
    summary?: string,
    triggerReason?: TriggerReason
  ): Promise<string> {
    const persona = await this.prompts.getPersona();

    this.logger.debug(
      {
        messages: history.length,
        summary: !!summary,
      },
      'Publishing generateMessage request'
    );

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      {
        role: 'system',
        content: await this.prompts.getPriorityRulesSystemPrompt(),
      },
      {
        role: 'system',
        content: await this.prompts.getUserPromptSystemPrompt(),
      },
    ];

    if (summary) {
      messages.push({
        role: 'system',
        content: await this.prompts.getAskSummaryPrompt(summary),
      });
    }
    if (triggerReason) {
      messages.push({
        role: 'system',
        content: await this.prompts.getTriggerPrompt(
          triggerReason.why,
          triggerReason.message
        ),
      });
    }

    const historyMessages = await Promise.all(
      history.map<Promise<ChatCompletionMessageParam>>(async (m) =>
        m.role === 'user'
          ? {
              role: 'user',
              content: await this.prompts.getUserPrompt(
                m.content,
                m.messageId?.toString(),
                m.username,
                m.fullName,
                m.replyText,
                m.quoteText,
                m.attitude ?? undefined
              ),
            }
          : { role: 'assistant', content: m.content }
      )
    );
    messages.push(...historyMessages);

    const request: OpenAIRequest = {
      type: 'generateMessage',
      body: {
        model: this.askModel,
        messages,
      },
    };

    await this.rabbit.publish(
      JSON.stringify(request),
      OPENAI_REQUEST_PRIORITY.generateMessage
    );
    void this.logPrompt('generateMessage', messages);
    return '';
  }

  public async checkInterest(
    history: ChatMessage[],
    _summary: string
  ): Promise<{ messageId: string; why: string } | null> {
    const persona = await this.prompts.getPersona();
    const checkPrompt = await this.prompts.getInterestCheckPrompt();
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      { role: 'system', content: checkPrompt },
    ];
    const historyMessages = await Promise.all(
      history.map<Promise<ChatCompletionMessageParam>>(async (m) =>
        m.role === 'user'
          ? {
              role: 'user',
              content: await this.prompts.getUserPrompt(
                m.content,
                m.messageId?.toString(),
                m.username,
                m.fullName,
                m.replyText,
                m.quoteText
              ),
            }
          : { role: 'assistant', content: m.content }
      )
    );
    messages.push(...historyMessages);
    this.logger.debug(
      {
        messages: history.length,
      },
      'Publishing checkInterest request'
    );
    const request: OpenAIRequest = {
      type: 'checkInterest',
      body: {
        model: this.interestModel,
        messages,
      },
    };
    await this.rabbit.publish(
      JSON.stringify(request),
      OPENAI_REQUEST_PRIORITY.checkInterest
    );
    void this.logPrompt('checkInterest', messages);
    return null;
  }

  public async assessUsers(
    messages: ChatMessage[],
    prevAttitudes: { username: string; attitude: string }[] = []
  ): Promise<{ username: string; attitude: string }[]> {
    const persona = await this.prompts.getPersona();
    const systemPrompt = await this.prompts.getAssessUsersPrompt();
    const reqMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      { role: 'system', content: systemPrompt },
    ];
    if (prevAttitudes.length > 0) {
      const attitudesText = prevAttitudes
        .map((a) => `${a.username}: ${a.attitude}`)
        .join('\n');
      reqMessages.push({
        role: 'system',
        content: `Предыдущее отношение бота к пользователям:\n${attitudesText}`,
      });
    }
    const historyMessages = await Promise.all(
      messages.map<Promise<ChatCompletionMessageParam>>(async (m) =>
        m.role === 'user'
          ? {
              role: 'user',
              content: await this.prompts.getUserPrompt(
                m.content,
                m.messageId?.toString(),
                m.username,
                m.fullName,
                m.replyText,
                m.quoteText,
                m.attitude ?? undefined
              ),
            }
          : { role: 'assistant', content: m.content }
      )
    );
    reqMessages.push(...historyMessages);
    this.logger.debug(
      {
        messages: messages.length,
      },
      'Publishing assessUsers request'
    );
    const request: OpenAIRequest = {
      type: 'assessUsers',
      body: {
        model: this.summaryModel,
        messages: reqMessages,
      },
    };
    await this.rabbit.publish(
      JSON.stringify(request),
      OPENAI_REQUEST_PRIORITY.assessUsers
    );
    void this.logPrompt('assessUsers', reqMessages);
    return [];
  }

  public async summarize(
    history: ChatMessage[],
    prev?: string
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: await this.prompts.getSummarizationSystemPrompt(),
      },
    ];
    this.logger.debug(
      {
        history: history.length,
        prevLength: prev?.length ?? 0,
      },
      'Sending summarization request'
    );
    if (prev) {
      messages.push({
        role: 'user',
        content: await this.prompts.getPreviousSummaryPrompt(prev),
      });
    }
    const historyText = (
      await Promise.all(
        history.map(async (m) =>
          m.role === 'user'
            ? await this.prompts.getUserPrompt(
                m.content,
                m.messageId?.toString(),
                m.username,
                m.fullName,
                m.replyText,
                m.quoteText
              )
            : `Ассистент: ${m.content}`
        )
      )
    ).join('\n');
    messages.push({
      role: 'user',
      content: `История диалога:\n${historyText}`,
    });
    const request: OpenAIRequest = {
      type: 'summarizeHistory',
      body: {
        model: this.summaryModel,
        messages,
      },
    };
    await this.rabbit.publish(
      JSON.stringify(request),
      OPENAI_REQUEST_PRIORITY.summarizeHistory
    );
    void this.logPrompt('summarizeHistory', messages);
    return prev ?? '';
  }

  private async logPrompt(
    type: OpenAIRequest['type'],
    messages: ChatCompletionMessageParam[],
    response?: string
  ): Promise<void> {
    if (!this.envService.env.LOG_PROMPTS) {
      return;
    }
    const filePath = path.join(process.cwd(), 'prompts.log');
    const entry = `\n[${new Date().toISOString()}] ${type}\nPROMPT:\n${JSON.stringify(
      messages,
      null,
      2
    )}\n${response ? `RESPONSE:\n${response}\n` : ''}---\n`;
    try {
      await fs.appendFile(filePath, entry);
    } catch (err) {
      this.logger.error({ err }, 'Failed to write prompt log');
    }
  }
}
