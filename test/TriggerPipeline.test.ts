import { describe, expect, it } from 'vitest';

import {
  DefaultTriggerPipeline,
  TriggerPipeline,
} from '../src/services/chat/TriggerPipeline';
import { TestEnvService } from '../src/services/env/EnvService';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import { TriggerContext } from '../src/triggers/Trigger';

describe('TriggerPipeline', () => {
  const env = new TestEnvService();

  it('returns true when mention trigger matches', async () => {
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(env, {
      async check() {
        return null;
      },
    });
    const ctx: any = { message: { text: 'hi @bot' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(true);
  });

  it('responds only when interest trigger returns true without mentions or replies', async () => {
    let result: { interested: boolean; messageId: string | null } | null = null;
    const interestChecker: InterestChecker = {
      async check() {
        return result;
      },
    };
    const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
      env,
      interestChecker
    );
    const ctx: any = { message: { text: 'hello there' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };

    let res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(false);

    result = { interested: false, messageId: null };
    res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(false);

    result = { interested: true, messageId: '1' };
    res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(true);
  });
});
