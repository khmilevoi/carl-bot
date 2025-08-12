import { describe, expect, it } from 'vitest';

import {
  DefaultTriggerPipeline,
  TriggerPipeline,
} from '../src/services/chat/TriggerPipeline';
import { TestEnvService } from '../src/services/env/EnvService';
import { TriggerContext } from '../src/triggers/Trigger';

describe('TriggerPipeline', () => {
  const pipeline: TriggerPipeline = new DefaultTriggerPipeline(
    new TestEnvService()
  );

  it('returns true when mention trigger matches', () => {
    const ctx: any = { message: { text: 'hi @bot' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hi @bot',
      replyText: '',
      chatId: 1,
    };
    const res = pipeline.shouldRespond(ctx, context);
    expect(res).toBe(true);
  });

  it('returns false when no trigger matches', () => {
    const ctx: any = { message: { text: 'hello there' }, me: 'bot' };
    const context: TriggerContext = {
      text: 'hello there',
      replyText: '',
      chatId: 1,
    };
    const res = pipeline.shouldRespond(ctx, context);
    expect(res).toBe(false);
  });
});
