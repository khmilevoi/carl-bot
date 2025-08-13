import { describe, expect, it } from 'vitest';

import { DialogueManager } from '../src/services/chat/DialogueManager';
import { MentionTrigger } from '../src/triggers/MentionTrigger';
import { NameTrigger } from '../src/triggers/NameTrigger';
import { ReplyTrigger } from '../src/triggers/ReplyTrigger';
import { TriggerContext } from '../src/triggers/Trigger';

describe('MentionTrigger', () => {
  const trigger = new MentionTrigger();

  it('removes bot mention and returns true', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx: any = {
      message: { text: 'hello @bot' },
      me: 'bot',
    };
    const res = await trigger.apply(telegrafCtx, ctx, new DialogueManager());
    expect(res).toBe(true);
    expect(ctx.text).toBe('hello');
  });

  it('returns false without mention', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx: any = {
      message: { text: 'hello there' },
      me: 'bot',
    };
    const res = await trigger.apply(telegrafCtx, ctx, new DialogueManager());
    expect(res).toBe(false);
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
    const res = await trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(true);
    expect(ctx.text).toBe('how are you?');
  });

  it('returns false when name missing', async () => {
    const ctx: TriggerContext = {
      text: 'Hello Arkadius',
      replyText: '',
      chatId: 1,
    };
    const res = await trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(false);
    expect(ctx.text).toBe('Hello Arkadius');
  });
});

describe('ReplyTrigger', () => {
  const trigger = new ReplyTrigger();

  it('matches when message replies to bot', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx: any = {
      me: 'bot',
      message: { reply_to_message: { from: { username: 'bot' } } },
    };
    const res = await trigger.apply(telegrafCtx, ctx, new DialogueManager());
    expect(res).toBe(true);
  });

  it('returns false when not replying to bot', async () => {
    const ctx: TriggerContext = { text: '', replyText: '', chatId: 1 };
    const telegrafCtx: any = { me: 'bot', message: {} };
    const res = await trigger.apply(telegrafCtx, ctx, new DialogueManager());
    expect(res).toBe(false);
  });
});
