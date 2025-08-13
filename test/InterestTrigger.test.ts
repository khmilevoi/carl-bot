import { describe, expect, it } from 'vitest';

import { DialogueManager } from '../src/services/chat/DialogueManager';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import { InterestTrigger } from '../src/triggers/InterestTrigger';
import { TriggerContext } from '../src/triggers/Trigger';

class MockInterestChecker implements InterestChecker {
  private count = 0;
  constructor(
    private readonly n: number,
    private readonly interested: boolean
  ) {}

  async check(): Promise<{
    interested: boolean;
    messageId: string | null;
  } | null> {
    this.count += 1;
    if (this.count < this.n) {
      return null;
    }
    return { interested: this.interested, messageId: null };
  }
}

describe('InterestTrigger', () => {
  const dialogue = new DialogueManager(1000);
  const baseCtx: TriggerContext = { text: '', replyText: '', chatId: 1 };

  it('returns false when message count is below threshold', async () => {
    const trigger = new InterestTrigger(new MockInterestChecker(3, true));
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).toBe(false);
  });

  it('returns true when threshold met and interested', async () => {
    const trigger = new InterestTrigger(new MockInterestChecker(2, true));
    await trigger.apply({} as any, baseCtx, dialogue);
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).toBe(true);
  });

  it('returns false when checker reports not interested', async () => {
    const trigger = new InterestTrigger(new MockInterestChecker(2, false));
    await trigger.apply({} as any, baseCtx, dialogue);
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).toBe(false);
  });
});
