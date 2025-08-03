import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogueManager } from '@/services/chat/DialogueManager';

describe('DialogueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('deactivates after timeout', () => {
    const dm = new DialogueManager(1000);
    dm.start(1);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(dm.isActive(1)).toBe(false);
  });

  it('extend resets timer', () => {
    const dm = new DialogueManager(1000);
    dm.start(1);
    vi.advanceTimersByTime(900);
    dm.extend(1);
    vi.advanceTimersByTime(900);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(200);
    expect(dm.isActive(1)).toBe(false);
  });
});
