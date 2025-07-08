import { readFileSync } from 'fs';
import { Context } from 'telegraf';
import { Trigger } from './Trigger';
import { PorterStemmerRu as Stemmer } from 'natural';

export class KeywordTrigger implements Trigger {
  private keywords: string[];
  private stems: string[];

  constructor(filename: string) {
    const data = readFileSync(filename, 'utf-8');
    this.keywords = data
      .split(/\r?\n/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    this.stems = this.keywords.map((k) => Stemmer.stem(k));
  }

  matches(ctx: Context): boolean {
    const text = ((ctx.message as any)?.text ?? '').toLowerCase();
    const words = text.match(/\p{L}+/gu) || [];
    for (const word of words) {
      const stem = Stemmer.stem(word);
      if (this.stems.some((s) => stem.includes(s) || s.includes(stem))) {
        return true;
      }
    }
    return false;
  }
}
