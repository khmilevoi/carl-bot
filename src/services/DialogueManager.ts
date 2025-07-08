export class DialogueManager {
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(private timeoutMs = 5 * 60 * 1000) {}

  private setTimer(chatId: number) {
    const existing = this.timers.get(chatId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(chatId);
    }, this.timeoutMs);
    this.timers.set(chatId, timer);
  }

  start(chatId: number) {
    this.setTimer(chatId);
  }

  extend(chatId: number) {
    this.setTimer(chatId);
  }

  isActive(chatId: number): boolean {
    return this.timers.has(chatId);
  }
}
