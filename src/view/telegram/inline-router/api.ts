import type { Button, Route } from './types';

export function route<A = unknown, P = unknown>(cfg: Route<A, P>): Route<A, P> {
  return cfg;
}

export function button<A = unknown>(cfg: Button<A>): Button<A> {
  return cfg;
}
