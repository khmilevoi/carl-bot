import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { MessageContext, Trigger, TriggerContext } from './Trigger';

export class ReplyTrigger implements Trigger {
  apply(
    ctx: MessageContext,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    if (ctx.replyUsername === ctx.me) {
      logger.debug({ chatId: context.chatId }, 'Reply trigger matched');
      return true;
    }
    return false;
  }
}
