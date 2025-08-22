import type { Context } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { DefaultDialogueManager } from '../src/application/use-cases/chat/DefaultDialogueManager';
import { DialogueManager } from '../src/application/interfaces/chat/DialogueManager.interface';
import { DefaultTriggerPipeline } from '../src/application/use-cases/chat/DefaultTriggerPipeline';
import { TriggerPipeline } from '../src/application/interfaces/chat/TriggerPipeline.interface';
import { InterestChecker } from '../src/application/interfaces/interest/InterestChecker.interface';
import { TriggerContext } from '../src/triggers/Trigger.interface';
import { InterestTrigger } from '../src/triggers/InterestTrigger';
import { MentionTrigger } from '../src/triggers/MentionTrigger';
import { NameTrigger } from '../src/triggers/NameTrigger';
import { ReplyTrigger } from '../src/triggers/ReplyTrigger';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory.interface';

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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(
        {
          async check() {
            return null;
          },
        },
        loggerFactory
      ),
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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
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
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      dialogue,
      { apply: vi.fn().mockResolvedValue(null) },
      { apply: vi.fn().mockResolvedValue(null) },
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
      loggerFactory
    );
    const ctx = {
      message: { text: 'hi @bot', reply_to_message: { message_id: 2 } },
      me: 'bot',
    } as unknown as Context;
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: 'original',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
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
      dialogue,
      new MentionTrigger(loggerFactory),
      new ReplyTrigger(loggerFactory),
      new NameTrigger(env.getBotName(), loggerFactory),
      new InterestTrigger(interestChecker, loggerFactory),
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
    const triggerLoggerFactory: LoggerFactory = {
      create: () => otherLogger,
    } as any;
    const pipelineLoggerFactory: LoggerFactory = {
      create: () => pipelineLogger,
    } as any;
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      triggerLoggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      dialogue,
      new MentionTrigger(triggerLoggerFactory),
      new ReplyTrigger(triggerLoggerFactory),
      new NameTrigger(env.getBotName(), triggerLoggerFactory),
      new InterestTrigger(
        { check: vi.fn().mockResolvedValue(null) },
        triggerLoggerFactory
      ),
      pipelineLoggerFactory
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
    const triggerLoggerFactory: LoggerFactory = {
      create: () => otherLogger,
    } as any;
    const pipelineLoggerFactory: LoggerFactory = {
      create: () => pipelineLogger,
    } as any;
    const interestChecker: InterestChecker = {
      check: vi.fn().mockResolvedValue(null),
    };
    const dialogue: DialogueManager = new DefaultDialogueManager(
      env,
      triggerLoggerFactory
    );
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      dialogue,
      new MentionTrigger(triggerLoggerFactory),
      new ReplyTrigger(triggerLoggerFactory),
      new NameTrigger(env.getBotName(), triggerLoggerFactory),
      new InterestTrigger(interestChecker, triggerLoggerFactory),
      pipelineLoggerFactory
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
