import { ChatMessage, ChatGPTService } from './ChatGPTService';

export class ChatMemory {
  private history: ChatMessage[] = [];
  private summary = '';

  constructor(private gpt: ChatGPTService, private limit = 10) {}

  public async addMessage(role: 'user' | 'assistant', content: string) {
    this.history.push({ role, content });
    if (this.history.length > this.limit) {
      this.summary = await this.gpt.summarize(this.history, this.summary);
      this.history = [];
    }
  }

  public getHistory(): ChatMessage[] {
    return this.history;
  }

  public getSummary(): string {
    return this.summary;
  }
}

export class ChatMemoryManager {
  private memories = new Map<number, ChatMemory>();

  constructor(private gpt: ChatGPTService, private limit = 10) {}

  public get(chatId: number): ChatMemory {
    let mem = this.memories.get(chatId);
    if (!mem) {
      mem = new ChatMemory(this.gpt, this.limit);
      this.memories.set(chatId, mem);
    }
    return mem;
  }

  public reset(chatId: number) {
    this.memories.delete(chatId);
  }
}
