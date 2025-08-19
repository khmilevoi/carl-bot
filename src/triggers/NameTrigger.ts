import type { Context } from 'telegraf';

import type { DialogueManager } from '../services/chat/DialogueManager';
import { PinoLogger } from '../services/logging/PinoLogger';
const logger = new PinoLogger();
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

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
