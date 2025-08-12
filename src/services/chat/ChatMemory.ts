import { inject, injectable } from 'inversify';

import { AI_SERVICE_ID, AIService, ChatMessage } from '../ai/AIService';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '../messages/MessageService';
import { StoredMessage } from '../messages/StoredMessage';
import {
  SUMMARY_SERVICE_ID,
  type SummaryService,
} from '../summaries/SummaryService';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './ChatResetService';

@injectable()
export class ChatMemory {
  constructor(
    private gpt: AIService,
    private messages: MessageService,
    private summaries: SummaryService,
    private chatId: number,
    private limit: number
  ) {}

  public async addMessage(message: StoredMessage) {
    const history = await this.messages.getMessages(this.chatId);
    logger.debug({ chatId: this.chatId, role: message.role }, 'Adding message');

    if (history.length > this.limit) {
      logger.debug({ chatId: this.chatId }, 'Summarizing chat history');
      const summary = await this.summaries.getSummary(this.chatId);
      const newSummary = await this.gpt.summarize(history, summary);
      await this.summaries.setSummary(this.chatId, newSummary);
      await this.messages.clearMessages(this.chatId);
    }

    await this.messages.addMessage({ ...message, chatId: this.chatId });
  }

  public getHistory(): Promise<ChatMessage[]> {
    return this.messages.getMessages(this.chatId);
  }

  public getSummary(): Promise<string> {
    return this.summaries.getSummary(this.chatId);
  }
}

@injectable()
export class ChatMemoryManager {
  private limit: number;

  constructor(
    @inject(AI_SERVICE_ID) private gpt: AIService,
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(CHAT_RESET_SERVICE_ID) private resetService: ChatResetService,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.limit = envService.env.CHAT_HISTORY_LIMIT;
  }

  public get(chatId: number): ChatMemory {
    logger.debug({ chatId }, 'Creating chat memory');
    return new ChatMemory(
      this.gpt,
      this.messages,
      this.summaries,
      chatId,
      this.limit
    );
  }

  public async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat memory');
    await this.resetService.reset(chatId);
  }
}
