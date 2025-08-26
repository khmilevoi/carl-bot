import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
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
import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { TriggerReason } from '@/domain/triggers/Trigger';

@injectable()
export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private readonly askModel: ChatModel;
  private readonly summaryModel: ChatModel;
  private readonly interestModel: ChatModel;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService,
    @inject(PROMPT_SERVICE_ID) private readonly prompts: PromptService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    const env = this.envService.env;
    this.openai = new OpenAI({ apiKey: env.OPENAI_KEY });
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
      'Sending chat completion request'
    );

    const messages: OpenAI.ChatCompletionMessageParam[] = [
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

    const attitudeMap = new Map<string, string>();
    const nameMap = new Map<string, { firstName: string; lastName: string }>();
    for (const m of history) {
      if (m.role === 'user' && m.username) {
        if (m.attitude && !attitudeMap.has(m.username)) {
          attitudeMap.set(m.username, m.attitude);
        }
        if (!nameMap.has(m.username)) {
          const firstName = m.firstName ?? m.fullName?.split(' ')[0] ?? '';
          const lastName =
            m.lastName ?? m.fullName?.split(' ').slice(1).join(' ') ?? '';
          if (firstName || lastName) {
            nameMap.set(m.username, { firstName, lastName });
          }
        }
      }
    }
    const names = Array.from(nameMap, ([username, v]) => ({
      username,
      firstName: v.firstName,
      lastName: v.lastName,
    }));
    if (names.length > 0) {
      messages.push({
        role: 'system',
        content: await this.prompts.getUserNamesPrompt(names),
      });
    }
    const attitudes = Array.from(attitudeMap, ([username, attitude]) => ({
      username,
      attitude,
    }));
    if (attitudes.length > 0) {
      messages.push({
        role: 'system',
        content: await this.prompts.getUserAttitudesPrompt(attitudes),
      });
    }

    const historyMessages = await Promise.all(
      history.map<Promise<OpenAI.ChatCompletionMessageParam>>(async (m) =>
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
    const start = Date.now();
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.askModel,
        messages,
      });
      const elapsedMs = Date.now() - start;
      this.logger.debug(
        {
          model: completion.model,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          elapsedMs,
        },
        'Received chat completion response'
      );
      const response = completion.choices[0]?.message?.content ?? '';
      void this.logPrompt('ask', messages, response);
      return response;
    } catch (err) {
      const elapsedMs = Date.now() - start;
      this.logger.error(
        { err, model: this.askModel, messages: messages.length, elapsedMs },
        'Chat completion request failed'
      );
      throw err;
    }
  }

  public async checkInterest(
    history: ChatMessage[],
    _summary: string
  ): Promise<{ messageId: string; why: string } | null> {
    const persona = await this.prompts.getPersona();
    const checkPrompt = await this.prompts.getInterestCheckPrompt();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      { role: 'system', content: checkPrompt },
    ];
    const historyMessages = await Promise.all(
      history.map<Promise<OpenAI.ChatCompletionMessageParam>>(async (m) =>
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
      'Sending interest check request'
    );
    const start = Date.now();
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.interestModel,
        messages,
      });
      const elapsedMs = Date.now() - start;
      this.logger.debug(
        {
          model: completion.model,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          elapsedMs,
        },
        'Received interest check response'
      );
      const content = completion.choices[0]?.message?.content ?? '';
      void this.logPrompt('interest', messages, content);
      try {
        return JSON.parse(content) as {
          messageId: string;
          why: string;
        } | null;
      } catch (err) {
        this.logger.error(
          {
            err,
            content,
          },
          'Failed to parse interest response'
        );
        return null;
      }
    } catch (err) {
      const elapsedMs = Date.now() - start;
      this.logger.error(
        {
          err,
          model: this.interestModel,
          messages: messages.length,
          elapsedMs,
        },
        'Interest check request failed'
      );
      throw err;
    }
  }

  public async assessUsers(
    messages: ChatMessage[],
    prevAttitudes: { username: string; attitude: string }[] = []
  ): Promise<{ username: string; attitude: string }[]> {
    const persona = await this.prompts.getPersona();
    const systemPrompt = await this.prompts.getAssessUsersPrompt();
    const reqMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      { role: 'system', content: systemPrompt },
    ];
    if (prevAttitudes.length > 0) {
      reqMessages.push({
        role: 'system',
        content: await this.prompts.getUserAttitudesPrompt(prevAttitudes),
      });
    }
    const nameMap = new Map<string, { firstName: string; lastName: string }>();
    for (const m of messages) {
      if (m.role === 'user' && m.username) {
        if (!nameMap.has(m.username)) {
          const firstName = m.firstName ?? m.fullName?.split(' ')[0] ?? '';
          const lastName =
            m.lastName ?? m.fullName?.split(' ').slice(1).join(' ') ?? '';
          if (firstName || lastName) {
            nameMap.set(m.username, { firstName, lastName });
          }
        }
      }
    }
    const names = Array.from(nameMap, ([username, v]) => ({
      username,
      firstName: v.firstName,
      lastName: v.lastName,
    }));
    if (names.length > 0) {
      reqMessages.push({
        role: 'system',
        content: await this.prompts.getUserNamesPrompt(names),
      });
    }
    const historyMessages = await Promise.all(
      messages.map<Promise<OpenAI.ChatCompletionMessageParam>>(async (m) =>
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
    reqMessages.push(...historyMessages);
    this.logger.debug(
      {
        messages: messages.length,
      },
      'Sending user attitude assessment request'
    );
    const start = Date.now();
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.summaryModel,
        messages: reqMessages,
      });
      const elapsedMs = Date.now() - start;
      this.logger.debug(
        {
          model: completion.model,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          elapsedMs,
        },
        'Received user attitude assessment response'
      );
      const content = completion.choices[0]?.message?.content ?? '[]';
      void this.logPrompt('assessUsers', reqMessages, content);
      try {
        return JSON.parse(content) as { username: string; attitude: string }[];
      } catch (err) {
        this.logger.error(
          {
            err,
            content,
          },
          'Failed to parse assessUsers response'
        );
        return [];
      }
    } catch (err) {
      const elapsedMs = Date.now() - start;
      this.logger.error(
        {
          err,
          model: this.summaryModel,
          messages: reqMessages.length,
          elapsedMs,
        },
        'User attitude assessment request failed'
      );
      throw err;
    }
  }

  public async summarize(
    history: ChatMessage[],
    prev?: string
  ): Promise<string> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
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
    const start = Date.now();
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.summaryModel,
        messages,
      });
      const elapsedMs = Date.now() - start;
      this.logger.debug(
        {
          model: completion.model,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          elapsedMs,
        },
        'Received summary response'
      );
      const response = completion.choices[0]?.message?.content ?? prev ?? '';
      void this.logPrompt('summary', messages, response);
      return response;
    } catch (err) {
      const elapsedMs = Date.now() - start;
      this.logger.error(
        { err, model: this.summaryModel, messages: messages.length, elapsedMs },
        'Summarization request failed'
      );
      throw err;
    }
  }

  private async logPrompt(
    type: string,
    messages: OpenAI.ChatCompletionMessageParam[],
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
