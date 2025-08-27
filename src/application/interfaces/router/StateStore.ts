type ButtonLike = {
  text: string;
  callback: string;
  action?: (...args: unknown[]) => unknown;
};

export type RouterState = {
  stack: string[];
  params: Record<string, unknown>;
  awaitingTextRouteId?: string;
  messages: Array<{
    messageId: number;
    text: string;
    buttons: ButtonLike[][];
    showBack: boolean;
    showCancel: boolean;
  }>;
};

export interface StateStore {
  get(key: string): Promise<RouterState | undefined>;
  set(key: string, state: RouterState): Promise<void>;
  delete(key: string): Promise<void>;
}

export const ROUTER_STATE_STORE_ID = Symbol('RouterStateStore');
