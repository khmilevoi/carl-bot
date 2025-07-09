import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  matches(ctx: Context): boolean {
    const text = (ctx.message as any)?.text ?? '';
    return this.pattern.test(text);
  }
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const text = context.text;
    if (this.pattern.test(text)) {
      context.text = text.replace(this.pattern, '').trim();
      dialogue.start(context.chatId);
      return true;
    }
    return false;
  }
}
