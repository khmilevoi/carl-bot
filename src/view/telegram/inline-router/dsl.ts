import type { Button } from './types';

export const DSL = {
  row<A = unknown>(...btns: Button<A>[]): Button<A>[] {
    return btns;
  },
  rows<A = unknown>(
    ...lines: Array<Button<A> | Button<A>[]>
  ): Array<Button<A> | Button<A>[]> {
    return lines;
  },
  pager<A = unknown>(
    page: number,
    pages: number,
    prev: Button<A>,
    next: Button<A>
  ): Button<A>[] {
    const out: Button<A>[] = [];
    if (page > 1) out.push(prev);
    if (page < pages) out.push(next);
    return out;
  },
};
