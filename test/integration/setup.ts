import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { vi } from 'vitest';
import type { Container } from 'inversify';

// Ensure we are in test mode before loading the container
process.env.NODE_ENV = 'test';
process.env.ADMIN_CHAT_ID = '1';
const tmpDbDir = mkdtempSync(join(tmpdir(), 'ark-bot-test-'));
process.env.DATABASE_URL = `file://${join(tmpDbDir, 'test.db')}`;

import {
  type AIService,
  AI_SERVICE_ID,
  type ChatMessage,
} from '../../src/services/ai/AIService.interface';
import type { TriggerReason } from '../../src/triggers/Trigger.interface';
import type { Context, Telegram } from 'telegraf';
let container: Container;

// Stable mock for AIService
class MockAIService implements AIService {
  async ask(
    _history: ChatMessage[],
    _summary?: string,
    _triggerReason?: TriggerReason
  ): Promise<string> {
    return 'mocked answer';
  }

  async summarize(_history: ChatMessage[], _prev?: string): Promise<string> {
    return 'mocked summary';
  }

  async checkInterest(
    _history: ChatMessage[],
    _summary: string
  ): Promise<{ messageId: string; why: string } | null> {
    return null;
  }

  async assessUsers(
    _messages: ChatMessage[],
    _prevAttitudes?: { username: string; attitude: string }[]
  ): Promise<{ username: string; attitude: string }[]> {
    return [];
  }
}

// Stable mock for Telegram API
class MockTelegram implements Partial<Telegram> {
  public sendMessage = vi.fn(async () => ({ message_id: 0 }));
  public sendChatAction = vi.fn(async () => {});
  public sendDocument = vi.fn(async () => ({ message_id: 0 }));
  public deleteWebhook = vi.fn(async () => {});
  public editMessageText = vi.fn(async () => {});
}

export async function init(): Promise<void> {
  const { container: c } = await import(`../../src/container?${Date.now()}`);
  container = c;
  const { migrateUp } = await import(`../../src/migrate?${Date.now()}`);
  await migrateUp();
  if (container.isBound(AI_SERVICE_ID)) {
    container.unbind(AI_SERVICE_ID);
  }
  container.bind<AIService>(AI_SERVICE_ID).to(MockAIService).inSingletonScope();
}

export interface MockContextOptions {
  chatId?: number;
  userId?: number;
  text?: string;
}

// Helper to create a Telegram context for tests
export function createContext(options: MockContextOptions = {}): Context {
  const { chatId = 1, userId = 1, text = '' } = options;
  const telegram = new MockTelegram();
  return {
    chat: { id: chatId, type: 'private' } as any,
    from: {
      id: userId,
      is_bot: false,
      first_name: 'user',
      username: 'user',
    } as any,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      from: { id: userId, is_bot: false, first_name: 'user', username: 'user' },
      text,
    } as any,
    telegram: telegram as unknown as Telegram,
    reply: vi.fn(async () => {}),
    replyWithDocument: vi.fn(async () => ({ message_id: 0 })),
    answerCbQuery: vi.fn(async () => {}),
    sendChatAction: vi.fn(async () => {}),
    deleteMessage: vi.fn(async () => {}),
  } as unknown as Context;
}

export { container };
export { MockAIService, MockTelegram };
