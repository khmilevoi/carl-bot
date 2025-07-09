import { describe, it, expect } from 'vitest';
import { KeywordTrigger } from '../src/triggers/KeywordTrigger';
import { TriggerContext } from '../src/triggers/Trigger';
import { DialogueManager } from '../src/services/DialogueManager';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('KeywordTrigger', () => {
  const file = join(tmpdir(), 'keywords-test.txt');
  writeFileSync(file, 'hello');
  const trigger = new KeywordTrigger(file);

  it('matches similar words', () => {
    const ctx: TriggerContext = { text: 'HeLLo there', replyText: '', chatId: 1 };
    const res = trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(true);
  });

  it('returns false when no match', () => {
    const ctx: TriggerContext = { text: 'bye', replyText: '', chatId: 1 };
    const res = trigger.apply({} as any, ctx, new DialogueManager());
    expect(res).toBe(false);
  });
});
