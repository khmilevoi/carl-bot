import { inject, injectable } from 'inversify';
import { Telegraf } from 'telegraf';

import type { ChatMessenger } from '@/application/interfaces/chat/ChatMessenger';
import {
  ENV_SERVICE_ID,
  type EnvService,
} from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';

@injectable()
export class TelegramMessenger implements ChatMessenger {
  public readonly bot: Telegraf;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.bot = new Telegraf(envService.env.BOT_TOKEN);
    this.logger = loggerFactory.create('TelegramMessenger');
  }

  async launch(): Promise<void> {
    this.logger.info('Launching bot');
    await this.bot.telegram
      .deleteWebhook()
      .catch((err) =>
        this.logger.warn({ err }, 'Failed to delete existing webhook')
      );
    await this.bot
      .launch()
      .then(() => this.logger.info('Bot launched'))
      .catch((err) => this.logger.error({ err }, 'Failed to launch bot'));
  }

  stop(reason: string): void {
    this.logger.info({ reason }, 'Stopping bot');
    this.bot.stop(reason);
  }

  async sendMessage(
    chatId: number,
    text: string,
    extra?: object
  ): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text, extra);
  }
}
