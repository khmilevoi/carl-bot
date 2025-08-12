import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/ai/AIService';
import { ChatMemory } from '../src/services/chat/ChatMemory';
import { InMemoryStorage } from '../src/services/storage/InMemoryStorage';

class FakeAI implements AIService {
  ask = vi.fn(async () => 'ok');
  summarize = vi.fn(async (_h: ChatMessage[]) => 'summary');
}

describe('ChatMemory', () => {
  let ai: FakeAI;
  let storage: InMemoryStorage;
  let memory: ChatMemory;

  beforeEach(() => {
    ai = new FakeAI();
    storage = new InMemoryStorage();
    memory = new ChatMemory(ai, storage, 1, 2);
  });

  it('summarizes when history exceeds limit', async () => {
    await memory.addMessage('user', 'm1', 'u1');
    await memory.addMessage('assistant', 'm2', 'bot');
    await memory.addMessage('user', 'm3', 'u1');
    expect(ai.summarize).not.toHaveBeenCalled();

    await memory.addMessage('assistant', 'm4', 'bot');
    expect(ai.summarize).toHaveBeenCalledOnce();
    expect(await memory.getSummary()).toBe('summary');
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      { role: 'assistant', content: 'm4', username: 'bot', chatId: 1 },
    ]);
  });

  it('stores user and message ids', async () => {
    await memory.addMessage(
      'user',
      'hello',
      'alice',
      undefined,
      undefined,
      undefined,
      undefined,
      7,
      42
    );
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      {
        role: 'user',
        content: 'hello',
        username: 'alice',
        userId: 7,
        messageId: 42,
        chatId: 1,
      },
    ]);
  });
});
