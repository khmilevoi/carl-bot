import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import { ChatModel } from 'openai/resources/shared';

import logger from '../logging/logger';
import { PROMPT_SERVICE_ID, PromptService } from '../prompts/PromptService';
import { AIService, ChatMessage } from './AIService';

@injectable()
export class ChatGPTService implements AIService {
  private openai: OpenAI;

  constructor(
    apiKey: string,
    private readonly askModel: ChatModel,
    private readonly summaryModel: ChatModel,
    @inject(PROMPT_SERVICE_ID) private readonly prompts: PromptService
  ) {
    this.openai = new OpenAI({ apiKey });
    logger.debug('ChatGPTService initialized');
  }

  public async ask(history: ChatMessage[], summary?: string): Promise<string> {
    const persona = await this.prompts.getPersona();
    logger.debug(
      { messages: history.length, summary: !!summary },
      'Sending chat completion request'
    );
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
    ];
    if (summary) {
      messages.push({
        role: 'system',
        content: this.prompts.getAskSummaryPrompt(summary),
      });
    }

    messages.push(
      ...history.map((m) => ({
        role: m.role,
        content: `Имя пользователя: ${m.username ?? 'Имя неизвестно'}; Текст сообщения: ${m.content}`,
      }))
    );

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
      .map((m) => {
        const name =
          m.role === 'user' ? (m.username ?? 'Пользователь') : 'Ассистент';
        return `${name}: ${m.content}`;
      })
      .join('\n');
    messages.push({
      role: 'user',
      content: `История диалога:\n${historyText}`,
    });
    const completion = await this.openai.chat.completions.create({
      model: this.summaryModel,
      messages,
    });
    logger.debug('Received summary response');
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
