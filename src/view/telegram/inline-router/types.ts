import type { Context, Telegraf } from 'telegraf';
import type {
  BotCommand,
  BotCommandScope,
  InlineKeyboardMarkup,
  Message,
} from 'telegraf/typings/core/types/typegram';

export type RenderMode = 'edit' | 'replace' | 'append' | 'smart';

export type Button<A = unknown> = {
  text: string;
  callback: string;
  action?: (args: {
    ctx: Context;
    actions: A;
    navigate: NavigateFn<A>;
    navigateBack: () => Promise<void>;
  }) => Promise<void> | void;
  answer?: {
    text?: string;
    alert?: boolean;
    url?: string;
    cacheTimeSec?: number;
  };
};

export type RouteView<A = unknown> = {
  text: string;
  buttons?: Array<Button<A> | Button<A>[]>;
  disablePreview?: boolean;
  renderMode?: RenderMode;
  showBack?: boolean;
  showCancel?: boolean;
};

export type NavigateFn<A = unknown> = <NP = void>(
  route: Route<A, NP>,
  ...p: NP extends void ? [] : [params: NP]
) => Promise<void>;

export type RouteActionArgs<A = unknown, P = void> = {
  ctx: Context;
  actions: A;
  params: P;
  navigate: NavigateFn<A>;
  navigateBack: () => Promise<void>;
  state: RouterState;
};

export type Route<A = unknown, P = void> = {
  id: string;
  actionName?: string;
  actionDescription?: string;
  action: (
    args: RouteActionArgs<A, P>
  ) => Promise<void | RouteView<A>> | void | RouteView<A>;
  onText?: (
    args: RouteActionArgs<A, P> & { text: string }
  ) => Promise<RouteView<A> | void> | RouteView<A> | void;
};

export type RouteNode<A = unknown> = {
  route: Route<A, unknown>;
  hasBack?: boolean;
  children?: Array<RouteNode<A> | Route<A, unknown>>;
};

export type RouterState = {
  stack: string[];
  params: Record<string, unknown>;
  awaitingTextRouteId?: string;
  messages: Array<{
    messageId: number;
    text: string;
    buttons: Button<unknown>[][];
    showBack: boolean;
    showCancel: boolean;
  }>;
};

export type StartOptions = {
  inputPrompt?: string;
  backLabel?: string;
  backCallbackData?: string;
  renderMode?: RenderMode;
  onEditFail?: 'reply' | 'replace' | 'ignore';
  errorRenderMode?: RenderMode;
  errorPrefix?: string;
  cancelLabel?: string;
  cancelCallbackData?: string;
  cancelCommands?: string[];
  showCancelOnWait?: boolean;
  cbVersion?: string;
  onError?: (err: unknown, ctx: Context, state: RouterState) => void;
  stateStore?: StateStore;
  tokenStore?: TokenStore;
  maxMessages?: number;
  commands?: BotCommand[];
  commandsExtra?: { scope?: BotCommandScope; language_code?: string };
};

export interface StateStore {
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}

export interface TokenStore {
  save(data: unknown, ttlMs?: number): Promise<string> | string;
  load(token: string): Promise<unknown | undefined> | unknown | undefined;
  delete?(token: string): Promise<void> | void;
}

export interface RunningRouter<A = unknown> {
  onText(fn: (ctx: Context) => Promise<void> | void): void;
  navigate<P = void>(
    ctx: Context,
    route: Route<A, P>,
    ...p: P extends void ? [] : [params: P]
  ): Promise<void>;
  navigateBack(ctx: Context): Promise<void>;
}

// Re-export external type dependencies for convenience
export type {
  BotCommand,
  BotCommandScope,
  Context,
  InlineKeyboardMarkup,
  Message,
  Telegraf,
};
