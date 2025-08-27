import { inject, injectable } from 'inversify';
import cron from 'node-cron';

import {
  AI_SERVICE_ID,
  type AIService,
} from '@/application/interfaces/ai/AIService';
import {
  BOT_SERVICE_ID,
  type BotService,
} from '@/application/interfaces/bot/BotService';
import {
  CHAT_CONFIG_SERVICE_ID,
  type ChatConfigService,
} from '@/application/interfaces/chat/ChatConfigService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import { type TopicOfDayScheduler } from '@/application/interfaces/scheduler/TopicOfDayScheduler';

@injectable()
export class TopicOfDaySchedulerImpl implements TopicOfDayScheduler {
  private readonly logger: Logger;
  constructor(
    @inject(CHAT_CONFIG_SERVICE_ID)
    private readonly chatConfig: ChatConfigService,
    @inject(AI_SERVICE_ID) private readonly ai: AIService,
    @inject(BOT_SERVICE_ID) private readonly bot: BotService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('TopicOfDayScheduler');
  }

  async start(): Promise<void> {
    const schedules = await this.chatConfig.getTopicOfDaySchedules?.();
    if (!schedules) {
      this.logger.debug('No topic of day schedules');
      return;
    }
    for (const [chatId, { time, timezone }] of schedules) {
      const [hourStr, minuteStr] = time.split(':');
      const hour = Number(hourStr);
      const minute = Number(minuteStr);
      const expr = `0 ${minute} ${hour} * * *`;
      cron.schedule(expr, () => void this.execute(chatId), { timezone });
      this.logger.debug(
        { chatId, cron: expr, timezone },
        'Registered topic of day job'
      );
    }
  }

  private async execute(chatId: number): Promise<void> {
    try {
      const article = await this.ai.generateTopicOfDay();
      await this.bot.sendMessage(chatId, article);
    } catch (err) {
      this.logger.error({ err, chatId }, 'Failed to send topic of day');
    }
  }
}
