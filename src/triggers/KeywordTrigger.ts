import { readFileSync } from 'fs';
import { Context } from 'telegraf';
import { Trigger } from './Trigger';

export class KeywordTrigger implements Trigger {
  private keywords: string[];

  constructor(filename: string) {
    const data = readFileSync(filename, 'utf-8');
    this.keywords = data
      .split(/\r?\n/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }

  matches(ctx: Context): boolean {
    const text = ((ctx.message as any)?.text ?? '').toLowerCase();
    return this.keywords.some((k) => text.includes(k));
  }
}
