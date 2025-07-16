import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { MessageContext, Trigger, TriggerContext } from './Trigger';

export class MentionTrigger implements Trigger {
  apply(
    ctx: MessageContext,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const text = ctx.text ?? '';
    if (text.includes(`@${ctx.me}`)) {
      context.text = text.replace(`@${ctx.me}`, '').trim();
      logger.debug({ chatId: context.chatId }, 'Mention trigger matched');
      return true;
    }
    return false;
  }
}
