import { describe, expect, it, vi } from 'vitest';

import { TelegramBot } from '../src/bot/TelegramBot';
import { TriggerReason } from '../src/triggers/Trigger';

class MockEnvService {
  env = { BOT_TOKEN: 'token' } as any;
}

class MockChatMemory {
  addMessage = vi.fn();
  getHistory = vi.fn(async () => []);
}

class MockChatMemoryManager {
  memory = new MockChatMemory();
  get = vi.fn(() => this.memory);
  reset = vi.fn();
}

class DummyAdmin {}

class DummyExtractor {
  extract() {
    return {};
  }
}

class DummyPipeline {
  shouldRespond = vi.fn(async () => null);
}

class DummyResponder {
  generate = vi.fn(
    async (_ctx?: any, _id?: number, _reason?: TriggerReason) => ''
  );
}

class DummyApprovalService {
  request = vi.fn(async () => {});
  approve = vi.fn(async () => {});
  ban = vi.fn(async () => {});
  unban = vi.fn(async () => {});
  getStatus = vi.fn(async () => 'approved');
}

describe('TelegramBot', () => {
  it('stores user messages via ChatMemoryManager', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(TelegramBot.prototype as any, 'configure')
      .mockImplementation(() => {});
    const bot = new TelegramBot(
      new MockEnvService() as any,
      memories as any,
      new DummyAdmin() as any,
      new DummyApprovalService() as any,
      new DummyExtractor() as any,
      new DummyPipeline() as any,
      new DummyResponder() as any
    );
    configureSpy.mockRestore();

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      message: { text: 'hi', message_id: 3 },
    };

    await (bot as any).handleText(ctx);

    expect(memories.get).toHaveBeenCalledWith(1);
    expect(memories.memory.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'hi' })
    );
  });
});
