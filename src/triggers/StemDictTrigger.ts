import { readFileSync } from 'fs';
import { PorterStemmerRu } from 'natural';
import { Context } from 'telegraf';

import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { Trigger, TriggerContext } from './Trigger';

interface MultiEntry {
  concept: string;
  stems: string[];
  len: number;
}

export class StemDictTrigger implements Trigger {
  private entries: MultiEntry[] = [];

  constructor(filename = 'keywords.json') {
    const dict: Record<string, string[]> = JSON.parse(
      readFileSync(filename, 'utf-8')
    );
    for (const [concept, words] of Object.entries(dict)) {
      for (const phrase of words) {
        const stems = phrase
          .toLowerCase()
          .match(/\p{L}+/gu)!
          .map((w) => PorterStemmerRu.stem(w));
        this.entries.push({ concept, stems, len: stems.length });
      }
    }
    logger.debug(
      { entries: this.entries.length },
      'Loaded multi-stem entries for triggers'
    );
  }

  apply(
    _ctx: Context,
    { text, chatId }: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const tokens = (text.match(/\p{L}+/gu) || []).map((t) =>
      PorterStemmerRu.stem(t.toLowerCase())
    );

    for (const { concept, stems, len } of this.entries) {
      if (len === 1) {
        if (tokens.includes(stems[0])) return true;
        continue;
      }

      for (let i = 0; i <= tokens.length - len; i++) {
        let ok = true;
        for (let j = 0; j < len; j++) {
          if (tokens[i + j] !== stems[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          logger.debug({ chatId, concept }, 'Multi-stem matched');
          return true;
        }
      }
    }
    return false;
  }
}
