import { MemoryStorage } from './MemoryStorage.interface';

export class InMemoryStorage implements MemoryStorage {
  private messages = new Map<
    number,
    { role: 'user' | 'assistant'; content: string }[]
  >();
  private summaries = new Map<number, string>();

  async addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string
  ) {
    const list = this.messages.get(chatId) ?? [];
    list.push({ role, content });
    this.messages.set(chatId, list);
  }

  async getMessages(chatId: number) {
    return this.messages.get(chatId) ?? [];
  }

  async clearMessages(chatId: number) {
    this.messages.set(chatId, []);
  }

  async getSummary(chatId: number) {
    return this.summaries.get(chatId) ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    this.summaries.set(chatId, summary);
  }

  async reset(chatId: number) {
    this.messages.delete(chatId);
    this.summaries.delete(chatId);
  }}
