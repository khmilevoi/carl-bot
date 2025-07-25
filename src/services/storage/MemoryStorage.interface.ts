export interface MemoryStorage {
  addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string,
    username?: string
  ): Promise<void>;
  getMessages(
    chatId: number
  ): Promise<
    { role: 'user' | 'assistant'; content: string; username?: string }[]
  >;
  clearMessages(chatId: number): Promise<void>;
  getSummary(chatId: number): Promise<string>;
  setSummary(chatId: number, summary: string): Promise<void>;
  reset(chatId: number): Promise<void>;
}
