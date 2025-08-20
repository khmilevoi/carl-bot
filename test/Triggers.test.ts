import type { Context } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { DefaultDialogueManager } from '../src/services/chat/DialogueManager';
import { TestEnvService } from '../src/services/env/EnvService';
import { MentionTrigger } from '../src/triggers/MentionTrigger';
import { NameTrigger } from '../src/triggers/NameTrigger';
import { ReplyTrigger } from '../src/triggers/ReplyTrigger';
import { TriggerContext } from '../src/triggers/Trigger.interface';
import type { LoggerFactory } from '../src/services/logging/LoggerService';

const createLoggerFactory = (): LoggerFactory =>
  ({
    create: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  }) as unknown as LoggerFactory;

describe('MentionTrigger', () => {
  const trigger = new MentionTrigger();

  it('removes bot mention and returns result', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx = {
      message: { text: 'hello @bot' },
      me: 'bot',
    } as unknown as Context;
    const res = await trigger.apply(
      telegrafCtx,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).not.toBeNull();
    expect(res?.replyToMessageId).toBeNull();
    expect(res?.reason).toBeNull();
    expect(ctx.text).toBe('hello');
  });

  it('returns null without mention', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx = {
      message: { text: 'hello there' },
      me: 'bot',
    } as unknown as Context;
    const res = await trigger.apply(
      telegrafCtx,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).toBeNull();
    expect(ctx.text).toBe('');
  });

  it('handles non-string fields gracefully', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx = { message: {}, me: undefined } as unknown as Context;
    const res = await trigger.apply(
      telegrafCtx,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).toBeNull();
    expect(ctx.text).toBe('');
  });
});

describe('NameTrigger', () => {
  const trigger = new NameTrigger('Arkadius');

  it('recognizes name at start of text', async () => {
    const ctx: TriggerContext = {
      text: 'Arkadius, how are you?',
      replyText: '',
      chatId: 1,
    };
    const res = await trigger.apply(
      {} as unknown as Context,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).not.toBeNull();
    expect(ctx.text).toBe('how are you?');
  });

  it('returns null when name missing', async () => {
    const ctx: TriggerContext = {
      text: 'Hello Arkadius',
      replyText: '',
      chatId: 1,
    };
    const res = await trigger.apply(
      {} as unknown as Context,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).toBeNull();
    expect(ctx.text).toBe('Hello Arkadius');
  });
});

describe('ReplyTrigger', () => {
  const trigger = new ReplyTrigger();

  it('matches when message replies to bot', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx = {
      me: 'bot',
      message: { reply_to_message: { from: { username: 'bot' } } },
    } as unknown as Context;
    const res = await trigger.apply(
      telegrafCtx,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).not.toBeNull();
  });

  it('returns null when not replying to bot', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx = { me: 'bot', message: {} } as unknown as Context;
    const res = await trigger.apply(
      telegrafCtx,
      ctx,
      new DefaultDialogueManager(new TestEnvService(), createLoggerFactory())
    );
    expect(res).toBeNull();
  });
});
