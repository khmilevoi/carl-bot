import { Context } from 'telegraf';

export interface Trigger {
  matches(ctx: Context): boolean;
}
