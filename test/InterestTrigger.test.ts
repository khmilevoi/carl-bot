import { describe, expect, it } from 'vitest';

import { DialogueManager } from '../src/services/chat/DialogueManager';
import { InterestChecker } from '../src/services/interest/InterestChecker';
import { InterestTrigger } from '../src/triggers/InterestTrigger';
import { TriggerContext } from '../src/triggers/Trigger';

class MockInterestChecker implements InterestChecker {
  private count = 0;
  constructor(
    private readonly n: number,
    private readonly result: { messageId: string; why: string } | null
  ) {}

  async check(): Promise<{ messageId: string; why: string } | null> {
    this.count += 1;
    if (this.count < this.n) {
      return null;
    }
    return this.result;
  }
}

describe('InterestTrigger', () => {
  const dialogue = new DialogueManager(1000);
  const baseCtx: TriggerContext = { text: '', replyText: '', chatId: 1 };

  it('returns null when message count is below threshold', async () => {
    const trigger = new InterestTrigger(
      new MockInterestChecker(3, { messageId: '1', why: 'because' })
    );
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).toBeNull();
  });

  it('returns result when threshold met and interested', async () => {
    const trigger = new InterestTrigger(
      new MockInterestChecker(2, { messageId: '1', why: 'because' })
    );
    await trigger.apply({} as any, baseCtx, dialogue);
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).not.toBeNull();
    expect(res?.replyToMessageId).toBe(1);
    expect(res?.reason).toBe('because');
  });

  it('returns null when checker reports not interested', async () => {
    const trigger = new InterestTrigger(new MockInterestChecker(2, null));
    await trigger.apply({} as any, baseCtx, dialogue);
    const res = await trigger.apply({} as any, baseCtx, dialogue);
    expect(res).toBeNull();
  });
});
