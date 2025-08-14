import { describe, expect, it } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService';
import { ChatMemoryManager } from '../src/services/chat/ChatMemory';
import {
  ChatResponder,
  DefaultChatResponder,
} from '../src/services/chat/ChatResponder';
import { SummaryService } from '../src/services/summaries/SummaryService';
import { TriggerReason } from '../src/triggers/Trigger';

class MockAIService {
  history: ChatMessage[] | undefined;
  summary: string | undefined;
  reason: TriggerReason | undefined;
  attitudes: { username: string; attitude?: string | null }[] | undefined;
  async ask(
    h: ChatMessage[],
    s?: string,
    r?: TriggerReason,
    a?: { username: string; attitude?: string | null }[]
  ): Promise<string> {
    this.history = h;
    this.summary = s;
    this.reason = r;
    this.attitudes = a;
    return 'answer';
  }
  async summarize(): Promise<string> {
    return '';
  }
  async checkInterest(): Promise<{ messageId: string; why: string } | null> {
    return null;
  }
}

class MockChatMemory {
  messages: ChatMessage[] = [];
  async addMessage(msg: any): Promise<void> {
    this.messages.push(msg);
  }
  async getHistory(): Promise<ChatMessage[]> {
    return [...this.messages];
  }
}

class MockChatMemoryManager implements ChatMemoryManager {
  memory = new MockChatMemory();
  get(_chatId: number): any {
    return this.memory;
  }
  async reset(): Promise<void> {}
}

class MockSummaryService implements SummaryService {
  async getSummary(): Promise<string> {
    return '';
  }
  async setSummary(): Promise<void> {}
}

class MockChatUserRepository {
  async link(): Promise<void> {}
  async listByChat(_chatId: number): Promise<number[]> {
    return [1];
  }
}

class MockUserRepository {
  async upsert(): Promise<void> {}
  async findById(id: number): Promise<any> {
    return { id, username: 'user1', attitude: 'friendly' };
  }
  async setAttitude(): Promise<void> {}
}

describe('ChatResponder', () => {
  it('generates answer and stores assistant message', async () => {
    const ai = new MockAIService();
    const memories = new MockChatMemoryManager();
    const summaries = new MockSummaryService();
    const chatUsers = new MockChatUserRepository();
    const users = new MockUserRepository();
    const responder: ChatResponder = new DefaultChatResponder(
      ai as any,
      memories as any,
      summaries,
      chatUsers as any,
      users as any
    );

    await memories.get(1).addMessage({ role: 'user', content: 'hi' });
    const ctx: any = { me: 'bot', chat: { id: 1 } };

    const answer = await responder.generate(ctx, 1, {
      why: 'why',
      message: 'hi',
    });
    expect(answer).toBe('answer');
    expect(ai.history).toHaveLength(1);
    expect(ai.reason).toEqual({ why: 'why', message: 'hi' });
    expect(ai.attitudes).toEqual([{ username: 'user1', attitude: 'friendly' }]);
    expect(memories.memory.messages).toHaveLength(2);
    expect(memories.memory.messages[1].role).toBe('assistant');
    expect(memories.memory.messages[1].content).toBe('answer');
  });
});
