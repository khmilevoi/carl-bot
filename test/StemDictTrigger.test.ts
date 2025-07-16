import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { DialogueManager } from '../src/services/DialogueManager';
import { StemDictTrigger } from '../src/triggers/StemDictTrigger';
import { TriggerContext } from '../src/triggers/Trigger';

describe('StemDictTrigger', () => {
  const file = join(tmpdir(), 'keywords-test.json');
  writeFileSync(file, JSON.stringify({ hello: ['hello'] }));
  const trigger = new StemDictTrigger(file);

  it('matches stemmed words', () => {
    const ctx: TriggerContext = {
      text: 'HeLLo there',
      replyText: '',
      chatId: 1,
    };
    const res = trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(true);
  });

  it('returns false when no match', () => {
    const ctx: TriggerContext = { text: 'bye', replyText: '', chatId: 1 };
    const res = trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(false);
  });
});
