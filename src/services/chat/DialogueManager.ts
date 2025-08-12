import logger from '../logging/logger';

export class DialogueManager {
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(private timeoutMs: number) {}

  private setTimer(chatId: number) {
    const existing = this.timers.get(chatId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(chatId);
      logger.debug({ chatId }, 'Dialogue timed out');
    }, this.timeoutMs);
    this.timers.set(chatId, timer);
  }

  start(chatId: number) {
    logger.debug({ chatId }, 'Starting dialogue');
    this.setTimer(chatId);
  }

  extend(chatId: number) {
    logger.debug({ chatId }, 'Extending dialogue');
    this.setTimer(chatId);
  }

  isActive(chatId: number): boolean {
    return this.timers.has(chatId);
  }
}
