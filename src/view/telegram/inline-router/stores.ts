import type { RouterState } from './types';

export interface StateStore {
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}

export interface TokenStore {
  save<T>(data: T, ttlMs?: number): Promise<string> | string;
  load<T>(token: string): Promise<T | undefined> | T | undefined;
  delete?(token: string): Promise<void> | void;
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

export class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, { data: unknown; exp?: number }>();
  save<T>(data: T, ttlMs?: number): string {
    const token = Math.random().toString(36).slice(2, 10);
    const exp = ttlMs ? Date.now() + ttlMs : undefined;
    this.map.set(token, { data, exp });
    return token;
  }
  load<T>(token: string): T | undefined {
    const rec = this.map.get(token);
    if (!rec) return undefined;
    if (rec.exp && Date.now() > rec.exp) {
      this.map.delete(token);
      return undefined;
    }
    return rec.data as T;
  }
  delete(token: string): void {
    this.map.delete(token);
  }
}
