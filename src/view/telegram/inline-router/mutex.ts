export class SimpleMutex {
  private queue = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queue.get(key) ?? Promise.resolve();
    let release!: () => void;
    const cur = new Promise<void>((resolve) => (release = resolve));
    this.queue.set(key, cur);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.queue.get(key) === cur) this.queue.delete(key);
    }
  }
}
