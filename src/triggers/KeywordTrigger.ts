import { readFileSync } from 'fs';
import { Context } from 'telegraf';

import { DialogueManager } from '../services/DialogueManager';
import { Trigger, TriggerContext } from './Trigger';

export class KeywordTrigger implements Trigger {
  private keywords: string[];

  private static similarity(a: string, b: string): number {
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    let max = 0;
    for (let i = 0; i < s1.length; i++) {
      for (let j = 0; j < s2.length; j++) {
        let k = 0;
        while (s1[i + k] && s2[j + k] && s1[i + k] === s2[j + k]) {
          k++;
        }
        if (k > max) {
          max = k;
        }
      }
    }
    return max / Math.max(s1.length, s2.length);
  }

  constructor(filename: string) {
    const data = readFileSync(filename, 'utf-8');
    this.keywords = data
      .split(/\r?\n/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }

  apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const text = context.text.toLowerCase();
    const words = text.match(/\p{L}+/gu) || [];
    for (const word of words) {
      for (const keyword of this.keywords) {
        if (KeywordTrigger.similarity(word, keyword) >= 0.75) {
          return true;
        }
      }
    }
    return false;
  }
}
