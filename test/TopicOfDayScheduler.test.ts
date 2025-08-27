import { describe, expect, it, vi } from 'vitest';
import * as cron from 'node-cron';

vi.mock('node-cron', () => ({ schedule: vi.fn() }));

import { TopicOfDaySchedulerImpl } from '../src/application/use-cases/scheduler/TopicOfDayScheduler';

describe('TopicOfDayScheduler', () => {
  it('schedules cron jobs and sends article', async () => {
    const chatConfig = {
      getTopicOfDaySchedules: vi.fn(async () => new Map([[1, '* * * * *']])),
    };
    const ai = { generateTopicOfDay: vi.fn(async () => 'article') };
    const bot = { sendMessage: vi.fn(async () => {}) };
    const loggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    };

    const scheduler = new TopicOfDaySchedulerImpl(
      chatConfig as any,
      ai as any,
      bot as any,
      loggerFactory as any
    );

    const scheduleMock = vi.mocked(cron.schedule);
    scheduleMock.mockImplementation((_expr, _cb) => {
      return {} as any;
    });

    await scheduler.start();
    expect(scheduleMock).toHaveBeenCalledWith(
      '* * * * *',
      expect.any(Function)
    );
    await (scheduler as any).execute(1);
    expect(ai.generateTopicOfDay).toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(1, 'article');
  });
});
