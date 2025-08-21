import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';
import type { Logger } from '../application/interfaces/logging/Logger.interface';
import { type LoggerFactory } from '../application/interfaces/logging/LoggerFactory.interface';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  private readonly logger: Logger;
  constructor(name: string, loggerFactory: LoggerFactory) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
    this.logger = loggerFactory.create('NameTrigger');
    this.logger.debug(
      { pattern: this.pattern },
      'Compiled name trigger pattern'
    );
  }
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const text = context.text;
    if (this.pattern.test(text)) {
      context.text = text.replace(this.pattern, '').trim();
      this.logger.debug({ chatId: context.chatId }, 'Name trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    this.logger.debug(
      { chatId: context.chatId, pattern: this.pattern, text },
      'Name trigger not matched'
    );
    return null;
  }
}
