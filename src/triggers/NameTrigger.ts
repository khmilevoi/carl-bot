import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const text = context.text;
    console.log({text})
    if (this.pattern.test(text)) {
      context.text = text.replace(this.pattern, '').trim();
      return true;
    }
    return false;
  }
}
