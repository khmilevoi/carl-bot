import { inject, injectable } from 'inversify';

import { ChatMessage } from '../ai/AIService.interface';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerService';
import {
  INTEREST_MESSAGE_STORE_ID,
  type InterestMessageStore,
} from '../messages/InterestMessageStore';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '../messages/MessageService.interface';
import { StoredMessage } from '../messages/StoredMessage.interface';
import {
  CHAT_CONFIG_SERVICE_ID,
  type ChatConfigService,
} from './ChatConfigService';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './ChatResetService.interface';
import { HISTORY_SUMMARIZER_ID, HistorySummarizer } from './HistorySummarizer';

@injectable()
export class ChatMemory {
  private readonly logger: Logger;

  constructor(
    private messages: MessageService,
    private summarizer: HistorySummarizer,
    private localStore: InterestMessageStore,
    private chatId: number,
    private limit: number,
    private loggerFactory: LoggerFactory
  ) {
    this.logger = this.loggerFactory.create('ChatMemory');
  }

  public async addMessage(message: StoredMessage): Promise<void> {
    this.logger.debug(
      {
        chatId: this.chatId,
        role: message.role,
        limit: this.limit,
      },
      'Adding message'
    );
    await this.messages.addMessage({ ...message, chatId: this.chatId });
    this.localStore.addMessage({ ...message, chatId: this.chatId });

    // Проверяем лимит после добавления сообщения
    const history = await this.messages.getMessages(this.chatId);
    this.logger.debug(
      {
        chatId: this.chatId,
        historyLength: history.length,
        limit: this.limit,
      },
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
  private readonly logger: Logger;

  constructor(
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(HISTORY_SUMMARIZER_ID) private summarizer: HistorySummarizer,
    @inject(CHAT_RESET_SERVICE_ID) private resetService: ChatResetService,
    @inject(INTEREST_MESSAGE_STORE_ID) private localStore: InterestMessageStore,
    @inject(CHAT_CONFIG_SERVICE_ID) private config: ChatConfigService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    this.logger = this.loggerFactory.create('ChatMemoryManager');
  }

  public async get(chatId: number): Promise<ChatMemory> {
    this.logger.debug({ chatId }, 'Creating chat memory');
    const { historyLimit } = await this.config.getConfig(chatId);
    return new ChatMemory(
      this.messages,
      this.summarizer,
      this.localStore,
      chatId,
      historyLimit,
      this.loggerFactory
    );
  }

  public async reset(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Resetting chat memory');
    await this.resetService.reset(chatId);
    this.localStore.clearMessages(chatId);
  }
}
