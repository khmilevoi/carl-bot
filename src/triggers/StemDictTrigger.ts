import { readFileSync } from 'fs';
import { PorterStemmerRu } from 'natural';
import { Context } from 'telegraf';

import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { Trigger, TriggerContext } from './Trigger';

type Dict = Record<string, string[]>;

export class StemDictTrigger implements Trigger {
  private stemsToConcept = new Map<string, string>();

  constructor(filename = 'keywords.json') {
    const dict: Dict = JSON.parse(readFileSync(filename, 'utf-8'));

    for (const [concept, words] of Object.entries(dict)) {
      for (const w of words) {
        const stem = PorterStemmerRu.stem(w.toLowerCase());
        this.stemsToConcept.set(stem, concept);
      }
    }
    logger.debug(
      { stems: this.stemsToConcept.size },
      'Loaded stems for triggers'
    );
  }

  apply(
    _ctx: Context,
    { text, chatId }: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const tokens = text.match(/\p{L}+/gu) || [];
    for (const t of tokens) {
      const stem = PorterStemmerRu.stem(t.toLowerCase());
      const concept = this.stemsToConcept.get(stem);
      if (concept) {
        logger.debug({ chatId, concept, stem }, 'Stem trigger matched');
        return true;
      }
    }
    return false;
  }
}
