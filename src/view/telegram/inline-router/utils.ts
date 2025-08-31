import type { RouterState } from './types';

export const topRouteId = (st: RouterState): string | undefined =>
  st.stack[st.stack.length - 1];
