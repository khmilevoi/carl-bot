import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/AIService';
import { ChatMemory } from '../src/services/ChatMemory';
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
    // No summary yet
    expect(ai.summarize).not.toHaveBeenCalled();

    await memory.addMessage('assistant', 'm4', 'bot');
    expect(ai.summarize).toHaveBeenCalledOnce();
    expect(await memory.getSummary()).toBe('summary');
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      { role: 'assistant', content: 'm4', username: 'bot' },
    ]);
  });
});
