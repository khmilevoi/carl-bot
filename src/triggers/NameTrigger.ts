import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext, TriggerResult } from './Trigger';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const text = context.text;
    if (this.pattern.test(text)) {
      context.text = text.replace(this.pattern, '').trim();
      logger.debug({ chatId: context.chatId }, 'Name trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}
