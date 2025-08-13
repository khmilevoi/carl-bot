import { describe, expect, it } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService';
import {
  ChatResponder,
  DefaultChatResponder,
} from '../src/services/chat/ChatResponder';
import { MessageService } from '../src/services/messages/MessageService';
import { SummaryService } from '../src/services/summaries/SummaryService';

class MockAIService {
  history: ChatMessage[] | undefined;
  summary: string | undefined;
  async ask(h: ChatMessage[], s?: string): Promise<string> {
    this.history = h;
    this.summary = s;
    return 'answer';
  }
  async summarize(): Promise<string> {
    return '';
  }
  async checkInterest(): Promise<{ messageId: string; why: string } | null> {
    return null;
  }
}

class MockMessageService implements MessageService {
  messages: ChatMessage[] = [];
  async addMessage(msg: any): Promise<void> {
    this.messages.push(msg);
  }
  async getMessages(_chatId: number): Promise<ChatMessage[]> {
    return [...this.messages];
  }
  async getCount(): Promise<number> {
    return this.messages.length;
  }
  async getLastMessages(_: number, limit: number): Promise<ChatMessage[]> {
    return [...this.messages].slice(-limit).reverse();
  }
  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}

class MockSummaryService implements SummaryService {
  async getSummary(): Promise<string> {
    return '';
  }
  async setSummary(): Promise<void> {}
}

describe('ChatResponder', () => {
  it('generates answer and stores assistant message', async () => {
    const ai = new MockAIService();
    const messages = new MockMessageService();
    const summaries = new MockSummaryService();
    const responder: ChatResponder = new DefaultChatResponder(
      ai as any,
      messages,
      summaries
    );

    await messages.addMessage({ role: 'user', content: 'hi' });
    const ctx: any = { me: 'bot', chat: { id: 1 } };

    const answer = await responder.generate(ctx, 1);
    expect(answer).toBe('answer');
    expect(ai.history).toHaveLength(1);
    expect(messages.messages).toHaveLength(2);
    expect(messages.messages[1].role).toBe('assistant');
    expect(messages.messages[1].content).toBe('answer');
  });
});
