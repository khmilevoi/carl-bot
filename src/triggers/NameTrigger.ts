import { Context } from 'telegraf';

import { DialogueManager } from '@/services/chat/DialogueManager';
import logger from '@/services/logging/logger';
import { Trigger, TriggerContext } from '@/triggers/Trigger';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const text = context.text;
    if (this.pattern.test(text)) {
      context.text = text.replace(this.pattern, '').trim();
      logger.debug({ chatId: context.chatId }, 'Name trigger matched');
      return true;
    }
    return false;
  }
}
