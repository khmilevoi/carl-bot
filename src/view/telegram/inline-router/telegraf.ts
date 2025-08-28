import type { Context } from 'telegraf';

export function getMatch(ctx: Context): readonly string[] | undefined {
  return (ctx as Context & { match?: string[] }).match;
}
