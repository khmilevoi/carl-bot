import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import { ChatModel } from 'openai/resources/shared';
import path from 'path';

import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import logger from '../logging/logger';
import { PROMPT_SERVICE_ID, PromptService } from '../prompts/PromptService';
import { AIService, ChatMessage } from './AIService';

@injectable()
export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private readonly askModel: ChatModel;
  private readonly summaryModel: ChatModel;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService,
    @inject(PROMPT_SERVICE_ID) private readonly prompts: PromptService
  ) {
    const env = this.envService.env;
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const models = this.envService.getModels();
    this.askModel = models.ask;
    this.summaryModel = models.summary;
    logger.debug('ChatGPTService initialized');
  }

  private async logPrompt(
    type: string,
    messages: OpenAI.ChatCompletionMessageParam[]
  ): Promise<void> {
    if (!this.envService.env.LOG_PROMPTS) {
      return;
    }
    const filePath = path.join(process.cwd(), 'prompts.log');
    const entry = `\n[${new Date().toISOString()}] ${type}\n${JSON.stringify(
      messages,
      null,
      2
    )}\n`;
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
      { role: 'system', content: this.prompts.getUserPromptSystemPrompt() },
    ];
    if (summary) {
      messages.push({
        role: 'system',
        content: this.prompts.getAskSummaryPrompt(summary),
      });
    }

    messages.push(
      ...history.map<OpenAI.ChatCompletionMessageParam>((m) =>
        m.role === 'user'
          ? {
              role: 'user',
              content: this.prompts.getUserPrompt(
                m.content,
                m.username,
                m.fullName,
                m.replyText,
                m.quoteText
              ),
            }
          : { role: 'assistant', content: m.content }
      )
    );

    void this.logPrompt('ask', messages);
    const completion = await this.openai.chat.completions.create({
      model: this.askModel,
      messages,
    });
    logger.debug('Received chat completion response');
    return completion.choices[0]?.message?.content ?? '';
  }

  public async summarize(
    history: ChatMessage[],
    prev?: string
  ): Promise<string> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.prompts.getSummarizationSystemPrompt() },
    ];
    logger.debug(
      { history: history.length, prevLength: prev?.length ?? 0 },
      'Sending summarization request'
    );
    if (prev) {
      messages.push({
        role: 'user',
        content: this.prompts.getPreviousSummaryPrompt(prev),
      });
    }
    const historyText = history
      .map((m) =>
        m.role === 'user'
          ? this.prompts.getUserPrompt(
              m.content,
              m.username,
              m.fullName,
              m.replyText,
              m.quoteText
            )
          : `Ассистент: ${m.content}`
      )
      .join('\n');
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
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
