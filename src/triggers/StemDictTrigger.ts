import { readFileSync } from 'fs';
import Snowball from 'node-snowball';
import { Context } from 'telegraf';

import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { Trigger, TriggerContext } from './Trigger';

const stemmer = Snowball as unknown as {
  stemword: (w: string, lang?: string) => string;
};

type Dict = Record<string, string[]>;

export class StemDictTrigger implements Trigger {
  private stemsToConcept = new Map<string, string>();

  constructor(filename = 'keywords.json') {
    const dict: Dict = JSON.parse(readFileSync(filename, 'utf-8'));

    for (const [concept, words] of Object.entries(dict)) {
      for (const w of words) {
        const stem = stemmer.stemword(w.toLowerCase(), 'russian');
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
      const stem = stemmer.stemword(t.toLowerCase(), 'russian');
      const concept = this.stemsToConcept.get(stem);
      if (concept) {
        logger.debug({ chatId, concept, stem }, 'Stem trigger matched');
        return true;
      }
    }
    return false;
  }
}
