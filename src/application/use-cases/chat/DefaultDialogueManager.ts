import { inject, injectable } from 'inversify';

import { type DialogueManager } from '@/application/interfaces/chat/DialogueManager';
import {
  ENV_SERVICE_ID,
  type EnvService,
} from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';

interface TimerData {
  timeout: NodeJS.Timeout;
  expiresAt: number;
}

@injectable()
export class DefaultDialogueManager implements DialogueManager {
  private timers = new Map<number, TimerData>();
  private timeoutMs: number;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    this.timeoutMs = envService.getDialogueTimeoutMs();
    this.logger = this.loggerFactory.create('DefaultDialogueManager');
  }

  start(chatId: number): void {
    this.logger.debug({ chatId }, 'Starting dialogue');
    this.setTimer(chatId);
  }

  extend(chatId: number): void {
    const existing = this.timers.get(chatId);
    const remainingMs = existing ? existing.expiresAt - Date.now() : 0;
    this.logger.debug({ chatId, remainingMs }, 'Extending dialogue');
    this.setTimer(chatId);
  }

  isActive(chatId: number): boolean {
    return this.timers.has(chatId);
  }

  private setTimer(chatId: number): void {
    const existing = this.timers.get(chatId);
    if (existing) {
      const remainingMs = existing.expiresAt - Date.now();
      this.logger.debug({ chatId, remainingMs }, 'Resetting dialogue timer');
      clearTimeout(existing.timeout);
    } else {
      this.logger.debug(
        { chatId, timeoutMs: this.timeoutMs },
        'Setting dialogue timer'
      );
    }
    const timer = setTimeout(() => {
      this.timers.delete(chatId);
      this.logger.debug({ chatId }, 'Dialogue timed out; timer cleared');
    }, this.timeoutMs);
    this.timers.set(chatId, {
      timeout: timer,
      expiresAt: Date.now() + this.timeoutMs,
    });
  }
}
