import { inject, injectable } from 'inversify';

import { ChatMessage } from '../ai/AIService.interface';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '../messages/MessageService.interface';
import { StoredMessage } from '../messages/StoredMessage.interface';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './ChatResetService.interface';
import { HISTORY_SUMMARIZER_ID, HistorySummarizer } from './HistorySummarizer';

@injectable()
export class ChatMemory {
  constructor(
    private messages: MessageService,
    private summarizer: HistorySummarizer,
    private chatId: number,
    private limit: number
  ) {}

  public async addMessage(message: StoredMessage) {
    logger.debug(
      { chatId: this.chatId, role: message.role, limit: this.limit },
      'Adding message'
    );
    await this.messages.addMessage({ ...message, chatId: this.chatId });

    // Проверяем лимит после добавления сообщения
    const history = await this.messages.getMessages(this.chatId);
    logger.debug(
      { chatId: this.chatId, historyLength: history.length, limit: this.limit },
      'Checking history limit after adding message'
    );
    const summarized = await this.summarizer.summarize(
      this.chatId,
      history,
      this.limit
    );
    if (summarized) {
      await this.summarizer.assessUsers(this.chatId, history);
    }
  }

  public getHistory(): Promise<ChatMessage[]> {
    return this.messages.getMessages(this.chatId);
  }
}

@injectable()
export class ChatMemoryManager {
  private limit: number;

  constructor(
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(HISTORY_SUMMARIZER_ID) private summarizer: HistorySummarizer,
    @inject(CHAT_RESET_SERVICE_ID) private resetService: ChatResetService,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.limit = envService.env.CHAT_HISTORY_LIMIT;
  }

  public get(chatId: number): ChatMemory {
    logger.debug({ chatId }, 'Creating chat memory');
    return new ChatMemory(this.messages, this.summarizer, chatId, this.limit);
  }

  public async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat memory');
    await this.resetService.reset(chatId);
  }
}
