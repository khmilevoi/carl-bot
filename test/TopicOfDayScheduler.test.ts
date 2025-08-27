import { describe, expect, it, vi } from 'vitest';
import cron from 'node-cron';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

import { TopicOfDaySchedulerImpl } from '../src/application/use-cases/scheduler/TopicOfDayScheduler';

describe('TopicOfDayScheduler', () => {
  it('schedules cron jobs and sends article', async () => {
    const chatConfig = {
      getTopicOfDaySchedules: vi.fn(
        async () => new Map([[1, { time: '09:00', timezone: 'UTC' }]])
      ),
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
    scheduleMock.mockImplementation((_expr, _cb, _opts) => {
      return {} as any;
    });

    await scheduler.start();
    expect(scheduleMock).toHaveBeenCalledWith(
      '0 0 9 * * *',
      expect.any(Function),
      { timezone: 'UTC' }
    );
    scheduleMock.mock.calls[0][1]();
    await (scheduler as any).execute(1);
    expect(ai.generateTopicOfDay).toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith(1, 'article');
  });
});
