import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { MessageContext, Trigger, TriggerContext } from './Trigger';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  apply(
    _ctx: MessageContext,
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
