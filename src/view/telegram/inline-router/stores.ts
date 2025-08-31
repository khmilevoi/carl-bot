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
    // Generate a cryptographically secure token
    const token = this.generateSecureToken();
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

  private generateSecureToken(): string {
    // Use crypto.randomUUID if available, fallback to secure random generation
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    }

    // Fallback for environments without crypto.randomUUID
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(10);
      crypto.getRandomValues(array);
      for (let i = 0; i < 10; i++) {
        result += chars[array[i] % chars.length];
      }
    } else {
      // Last resort fallback - still better than Math.random()
      for (let i = 0; i < 10; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }

    return result;
  }
}
