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
import type { LoggerFactory } from '../src/services/logging/LoggerFactory';

describe('TriggerPipeline', () => {
  const env = {
    getBotName: () => 'bot',
    getDialogueTimeoutMs: () => 0,
  } as any;
  const loggerFactory: LoggerFactory = {
    create: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  } as unknown as LoggerFactory;

  it('returns result when mention trigger matches', async () => {
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      {
        async check() {
          return null;
        },
      },
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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

  it('logs which trigger fired when a trigger matches', async () => {
    const pipelineLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const otherLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const loggerFactory: LoggerFactory = {
      create: vi
        .fn()
        .mockReturnValueOnce(otherLogger) // dialogue manager
        .mockReturnValueOnce(pipelineLogger) // trigger pipeline
        .mockReturnValue(otherLogger), // triggers
    } as unknown as LoggerFactory;
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      { check: vi.fn().mockResolvedValue(null) },
      dialogue,
      loggerFactory
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
    await pipeline.shouldRespond(ctx, context);
    expect(pipelineLogger.debug).toHaveBeenCalledWith(
      { chatId: 1, trigger: 'MentionTrigger' },
      'Trigger matched'
    );
  });

  it('logs when no triggers match', async () => {
    const pipelineLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const otherLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const loggerFactory: LoggerFactory = {
      create: vi
        .fn()
        .mockReturnValueOnce(otherLogger) // dialogue manager
        .mockReturnValueOnce(pipelineLogger) // trigger pipeline
        .mockReturnValue(otherLogger), // triggers
    } as unknown as LoggerFactory;
    const interestChecker: InterestChecker = {
      check: vi.fn().mockResolvedValue(null),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      loggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker,
      dialogue,
      loggerFactory
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
    await pipeline.shouldRespond(ctx, context);
    expect(pipelineLogger.debug).toHaveBeenCalledWith(
      { chatId: 1 },
      'No trigger matched'
    );
  });
});
