import type { RouteView } from './types';

export class RouterUserError extends Error {
  view?: Partial<RouteView<unknown>>;
  constructor(message: string, view?: Partial<RouteView<unknown>>) {
    super(message);
    this.name = 'RouterUserError';
    this.view = view;
  }
}
