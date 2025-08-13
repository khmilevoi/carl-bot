import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import { ChatModel } from 'openai/resources/shared';
import path from 'path';

import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';
import { PROMPT_SERVICE_ID, PromptService } from '../prompts/PromptService';
import { AIService, ChatMessage } from './AIService';

@injectable()
export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private readonly askModel: ChatModel;
  private readonly summaryModel: ChatModel;
  private readonly interestModel: ChatModel;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService,
    @inject(PROMPT_SERVICE_ID) private readonly prompts: PromptService
  ) {
    const env = this.envService.env;
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const models = this.envService.getModels();
    this.askModel = models.ask;
    this.summaryModel = models.summary;
    this.interestModel = models.interest;
    logger.debug('ChatGPTService initialized');
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
      logger.error({ err }, 'Failed to write prompt log');
    }
  }

  public async ask(history: ChatMessage[], summary?: string): Promise<string> {
    const persona = await this.prompts.getPersona();
    logger.debug(
      { messages: history.length, summary: !!summary },
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

    const completion = await this.openai.chat.completions.create({
      model: this.askModel,
      messages,
    });
    logger.debug('Received chat completion response');
    const response = completion.choices[0]?.message?.content ?? '';
    void this.logPrompt('ask', messages, response);
    return response;
  }

  public async checkInterest(
    history: ChatMessage[],
    summary: string
  ): Promise<{ messageId: string; why: string } | null> {
    const persona = await this.prompts.getPersona();
    const checkPrompt = await this.prompts.getInterestCheckPrompt();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
      { role: 'system', content: checkPrompt },
      { role: 'system', content: summary },
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
    void this.logPrompt('interest', messages);
    logger.debug(
      { messages: history.length },
      'Sending interest check request'
    );
    const completion = await this.openai.chat.completions.create({
      model: this.interestModel,
      messages,
    });
    logger.debug('Received interest check response');
    const content = completion.choices[0]?.message?.content ?? '';
    void this.logPrompt('interest', messages, content);
    try {
      return JSON.parse(content) as {
        messageId: string;
        why: string;
      } | null;
    } catch (err) {
      logger.error({ err, content }, 'Failed to parse interest response');
      return null;
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
    logger.debug(
      { history: history.length, prevLength: prev?.length ?? 0 },
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
    void this.logPrompt('summary', messages);
    const completion = await this.openai.chat.completions.create({
      model: this.summaryModel,
      messages,
    });
    logger.debug('Received summary response');
    const response = completion.choices[0]?.message?.content ?? prev ?? '';
    void this.logPrompt('summary', messages, response);
    return response;
  }
}
