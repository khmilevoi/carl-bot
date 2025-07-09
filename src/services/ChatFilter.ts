import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ChatFilter {
  isAllowed(chatId: number): boolean;
}

export class JSONWhiteListChatFilter implements ChatFilter {
  private ids = new Set<number>();

  constructor(private filename: string) {
    this.load();
  }

  private load() {
    try {
      const path = resolve(process.cwd(), this.filename);
      const data = JSON.parse(readFileSync(path, 'utf-8')) as number[];
      if (Array.isArray(data)) {
        this.ids = new Set(data.map((id) => Number(id)));
      }
    } catch {
      this.ids.clear();
    }
  }

  isAllowed(chatId: number): boolean {
    return this.ids.has(chatId);
  }
}
