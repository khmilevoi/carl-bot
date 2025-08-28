export class SimpleMutex {
  private queue = new Map<string, Promise<void>>();
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    this.queue.set(key, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.queue.get(key) === current) this.queue.delete(key);
    }
  }
}
