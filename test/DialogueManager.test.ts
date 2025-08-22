import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefaultDialogueManager } from '../src/application/use-cases/chat/DefaultDialogueManager';
import { DialogueManager } from '../src/application/interfaces/chat/DialogueManager.interface';
import { TestEnvService } from '../src/infrastructure/config/TestEnvService';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory.interface';

describe('DialogueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('deactivates after timeout', () => {
    const env = new TestEnvService();
    vi.spyOn(env, 'getDialogueTimeoutMs').mockReturnValue(1000);
    const loggerFactory: LoggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory;
    const dm: DialogueManager = new DefaultDialogueManager(env, loggerFactory);
    dm.start(1);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(dm.isActive(1)).toBe(false);
  });

  it('extend resets timer', () => {
    const env = new TestEnvService();
    vi.spyOn(env, 'getDialogueTimeoutMs').mockReturnValue(1000);
    const loggerFactory: LoggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory;
    const dm: DialogueManager = new DefaultDialogueManager(env, loggerFactory);
    dm.start(1);
    vi.advanceTimersByTime(900);
    dm.extend(1);
    vi.advanceTimersByTime(900);
    expect(dm.isActive(1)).toBe(true);
    vi.advanceTimersByTime(200);
    expect(dm.isActive(1)).toBe(false);
  });
});
