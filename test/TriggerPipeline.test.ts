import { describe, expect, it } from 'vitest';

import {
  DefaultTriggerPipeline,
  TriggerPipeline,
} from '../src/services/chat/TriggerPipeline';
import { TestEnvService } from '../src/services/env/EnvService';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import { TriggerContext } from '../src/triggers/Trigger';

describe('TriggerPipeline', () => {
  const interestChecker: InterestChecker = {
    async check() {
      return null;
    },
  };
  const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
    new TestEnvService(),
    interestChecker
  );

  it('returns true when mention trigger matches', async () => {
    const ctx: any = { message: { text: 'hi @bot' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(true);
  });

  it('returns false when no trigger matches', async () => {
    const ctx: any = { message: { text: 'hello there' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };
    const res = await pipeline.shouldRespond(ctx, context);
    expect(res).toBe(false);
  });
});
