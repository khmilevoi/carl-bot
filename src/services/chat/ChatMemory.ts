import { inject, injectable } from 'inversify';

import { ChatMessage } from '../ai/AIService';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '../messages/MessageService';
import { StoredMessage } from '../messages/StoredMessage';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './ChatResetService';
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
    const history = await this.messages.getMessages(this.chatId);
    logger.debug({ chatId: this.chatId, role: message.role }, 'Adding message');
    await this.summarizer.summarizeIfNeeded(this.chatId, history, this.limit);
    await this.messages.addMessage({ ...message, chatId: this.chatId });
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
