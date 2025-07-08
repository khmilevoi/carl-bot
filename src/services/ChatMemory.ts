import { ChatMessage, ChatGPTService } from './ChatGPTService';
import { MemoryStorage } from './MemoryStorage';

export class ChatMemory {
  constructor(
    private gpt: ChatGPTService,
    private store: MemoryStorage,
    private chatId: number,
    private limit = 10
  ) {}

  public async addMessage(role: 'user' | 'assistant', content: string) {
    await this.store.addMessage(this.chatId, role, content);
    const history = await this.store.getMessages(this.chatId);
    if (history.length > this.limit) {
      const summary = await this.store.getSummary(this.chatId);
      const newSummary = await this.gpt.summarize(history, summary);
      await this.store.setSummary(this.chatId, newSummary);
      await this.store.clearMessages(this.chatId);
    }
  }

  public getHistory(): Promise<ChatMessage[]> {
    return this.store.getMessages(this.chatId);
  }

  public getSummary(): Promise<string> {
    return this.store.getSummary(this.chatId);
  }
}

export class ChatMemoryManager {
  constructor(
    private gpt: ChatGPTService,
    private store: MemoryStorage,
    private limit = 10
  ) {}

  public get(chatId: number): ChatMemory {
    return new ChatMemory(this.gpt, this.store, chatId, this.limit);
  }

  public async reset(chatId: number) {
    await this.store.reset(chatId);
  }
}
