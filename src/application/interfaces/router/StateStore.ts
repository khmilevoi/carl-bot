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
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}

export const ROUTER_STATE_STORE_ID = Symbol('RouterStateStore');
