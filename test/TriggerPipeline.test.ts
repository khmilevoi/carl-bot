import type { Context } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  DefaultTriggerPipeline,
  TriggerPipeline,
} from '../src/services/chat/TriggerPipeline';
import { TestEnvService } from '../src/services/env/EnvService';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import { TriggerContext } from '../src/triggers/Trigger.interface';

describe('TriggerPipeline', () => {
  const env = new TestEnvService();

  it('returns result when mention trigger matches', async () => {
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(env, {
      async check() {
        return null;
      },
    });
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
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker
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
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker
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
});
