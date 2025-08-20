import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import { ENV_SERVICE_ID, type EnvService } from '../env/EnvService';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_SERVICE_ID,
  type LoggerService,
} from '../logging/LoggerService';

export interface DialogueManager {
  start(chatId: number): void;
  extend(chatId: number): void;
  isActive(chatId: number): boolean;
}

export const DIALOGUE_MANAGER_ID = Symbol.for(
  'DialogueManager'
) as ServiceIdentifier<DialogueManager>;

@injectable()
export class DefaultDialogueManager implements DialogueManager {
  private timers = new Map<number, NodeJS.Timeout>();
  private timeoutMs: number;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_SERVICE_ID) private loggerService: LoggerService
  ) {
    this.timeoutMs = envService.getDialogueTimeoutMs();
    this.logger = this.loggerService.createLogger();
  }

  start(chatId: number): void {
    this.logger.debug({ chatId }, 'Starting dialogue');
    this.setTimer(chatId);
  }

  extend(chatId: number): void {
    this.logger.debug({ chatId }, 'Extending dialogue');
    this.setTimer(chatId);
  }

  isActive(chatId: number): boolean {
    return this.timers.has(chatId);
  }

  private setTimer(chatId: number): void {
    const existing = this.timers.get(chatId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(chatId);
      this.logger.debug({ chatId }, 'Dialogue timed out');
    }, this.timeoutMs);
    this.timers.set(chatId, timer);
  }
}
