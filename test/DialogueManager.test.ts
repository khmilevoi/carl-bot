import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DefaultDialogueManager,
  type DialogueManager,
} from '../src/services/chat/DialogueManager';
import { TestEnvService } from '../src/services/env/EnvService';
import type { LoggerService } from '../src/services/logging/LoggerService';

describe('DialogueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('deactivates after timeout', () => {
    const env = new TestEnvService();
    vi.spyOn(env, 'getDialogueTimeoutMs').mockReturnValue(1000);
    const loggerService: LoggerService = {
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerService;
    const dm: DialogueManager = new DefaultDialogueManager(env, loggerService);
    dm.start(1);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(dm.isActive(1)).toBe(false);
  });

  it('extend resets timer', () => {
    const env = new TestEnvService();
    vi.spyOn(env, 'getDialogueTimeoutMs').mockReturnValue(1000);
    const loggerService: LoggerService = {
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerService;
    const dm: DialogueManager = new DefaultDialogueManager(env, loggerService);
    dm.start(1);
    vi.advanceTimersByTime(900);
    dm.extend(1);
    vi.advanceTimersByTime(900);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(200);
    expect(dm.isActive(1)).toBe(false);
  });
});
