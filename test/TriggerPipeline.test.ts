import type { Context } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  DefaultDialogueManager,
  type DialogueManager,
} from '../src/services/chat/DialogueManager';
import {
  DefaultTriggerPipeline,
  TriggerPipeline,
} from '../src/services/chat/TriggerPipeline';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import {
  type Trigger,
  TriggerContext,
} from '../src/triggers/Trigger.interface';
import type { LoggerService } from '../src/services/logging/LoggerService';

describe('TriggerPipeline', () => {
  const env = {
    getBotName: () => 'bot',
    getDialogueTimeoutMs: () => 0,
  } as any;
  const loggerService: LoggerService = {
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  } as unknown as LoggerService;

  it('returns result when mention trigger matches', async () => {
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      {
        async check() {
          return null;
        },
      },
      dialogue
    );
    const ctx = {
      message: { text: 'hi @bot' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).not.toBeNull();
  });

  it('exits early when a trigger matches', async () => {
    const interestChecker: InterestChecker = {
      check: vi.fn().mockResolvedValue(null),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    );
    const ctx = {
      message: { text: 'hi @bot' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).not.toBeNull();
    expect(interestChecker.check).not.toHaveBeenCalled();
  });

  it('responds only when interest trigger returns result without mentions or replies', async () => {
    let result: { messageId: string; message: string; why: string } | null =
      null;
    const interestChecker: InterestChecker = {
      async check() {
        return result;
      },
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    );
    const ctx = {
      message: { text: 'hello there' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };

    let res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBeNull();

    result = { messageId: '1', message: 'hi', why: 'because' };
    res = await pipeline.shouldRespond(ctx, context);
    expect(res).not.toBeNull();
  });

  it('uses interest trigger when mention and reply triggers return null', async () => {
    const interestChecker: InterestChecker = {
      check: vi
        .fn()
        .mockResolvedValue({ messageId: '1', message: 'hi', why: 'because' }),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    ) as DefaultTriggerPipeline & {
      mentionTrigger: Trigger;
      replyTrigger: Trigger;
    };
    pipeline.mentionTrigger = { apply: vi.fn().mockResolvedValue(null) };
    pipeline.replyTrigger = { apply: vi.fn().mockResolvedValue(null) };
    const ctx = {
      message: { text: 'hi @bot', reply_to_message: { message_id: 2 } },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: 'original',
      chatId: 1,
    };
    const res = await (pipeline as TriggerPipeline).shouldRespond(ctx, context);
    expect(res).not.toBeNull();
    expect(interestChecker.check).toHaveBeenCalled();
  });

  it('propagates error when interest checker fails', async () => {
    const interestChecker: InterestChecker = {
      check: vi.fn().mockRejectedValue(new Error('fail')),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    );
    const ctx = {
      message: { text: 'hello there' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };
    await expect(pipeline.shouldRespond(ctx, context)).rejects.toThrow('fail');
  });

  it('skips interest trigger when dialogue is active', async () => {
    const interestChecker: InterestChecker = {
      check: vi.fn().mockResolvedValue({
        messageId: '1',
        message: 'hi',
        why: 'because',
      }),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    );
    dialogue.start(1);
    const ctx = {
      message: { text: 'hello there' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBeNull();
    expect(interestChecker.check).not.toHaveBeenCalled();
  });

  it('does not extend dialogue timer when no triggers match', async () => {
    const interestChecker: InterestChecker = {
      check: vi.fn().mockResolvedValue(null),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerService
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue
    );
    const ctx = {
      message: { text: 'hello there' },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };
    dialogue.start(1);
    const extendSpy = vi.spyOn(dialogue, 'extend');
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBeNull();
    expect(extendSpy).not.toHaveBeenCalled();
  });
});
