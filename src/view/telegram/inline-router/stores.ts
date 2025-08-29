import type { RouterState } from './types';

export interface StateStore {
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}

export class InMemoryStateStore implements StateStore {
  private map = new Map<string, RouterState>();
  async get(chatId: number, userId: number): Promise<RouterState | undefined> {
    return this.map.get(`${chatId}:${userId}`);
  }
  async set(chatId: number, userId: number, state: RouterState): Promise<void> {
    this.map.set(`${chatId}:${userId}`, state);
  }
  async delete(chatId: number, userId: number): Promise<void> {
    this.map.delete(`${chatId}:${userId}`);
  }
}

export interface TokenStore {
  save(data: unknown, ttlMs?: number): Promise<string> | string;
  load(token: string): Promise<unknown | undefined> | unknown | undefined;
  delete?(token: string): Promise<void> | void;
}

export class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, { data: unknown; exp?: number }>();
  save(data: unknown, ttlMs?: number): string {
    const token = Math.random().toString(36).slice(2, 10);
    const exp = ttlMs ? Date.now() + ttlMs : undefined;
    this.map.set(token, { data, exp });
    return token;
  }
  load(token: string): unknown | undefined {
    const rec = this.map.get(token);
    if (!rec) return undefined;
    if (rec.exp && Date.now() > rec.exp) {
      this.map.delete(token);
      return undefined;
    }
    return rec.data;
  }
  delete(token: string): void {
    this.map.delete(token);
  }
}
