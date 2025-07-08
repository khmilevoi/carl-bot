import { Context } from 'telegraf';
import { Trigger } from './Trigger';

export class NameTrigger implements Trigger {
  private pattern: RegExp;
  constructor(name: string) {
    this.pattern = new RegExp(`^${name}[,:\\s]`, 'i');
  }
  matches(ctx: Context): boolean {
    const text = (ctx.message as any)?.text ?? '';
    return this.pattern.test(text);
  }
}
