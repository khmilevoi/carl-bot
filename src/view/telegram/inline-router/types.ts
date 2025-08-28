/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from 'telegraf';

export type RenderMode = 'edit' | 'replace' | 'append' | 'smart';

export type NavigateFn<A = unknown> = <NP = unknown>(
  route: Route<A, NP>,
  params?: NP
) => Promise<void>;

export type ButtonAnswer = {
  text?: string;
  showAlert?: boolean;
  url?: string;
  cacheTimeSec?: number;
};

export type Button<A = unknown> = {
  text: string;
  callback: string;
  action?: (args: {
    ctx: Context;
    actions: A;
    navigate: NavigateFn<A>;
    navigateBack: () => Promise<void>;
  }) => Promise<void> | void;
  answer?: ButtonAnswer;
};

export type RouteView<A = unknown> = {
  text: string;
  buttons?: Array<Button<A> | Button<A>[]>;
  disablePreview?: boolean;
  renderMode?: RenderMode;
  showBack?: boolean;
  showCancel?: boolean;
};

export type RouteActionArgs<A = unknown, P = unknown> = {
  ctx: Context;
  actions: A;
  params: P;
  navigate: NavigateFn<A>;
  navigateBack: () => Promise<void>;
  state: RouterState;
};

export type Route<A = unknown, P = unknown> = {
  id: string;
  action: (
    args: RouteActionArgs<A, P>
  ) => Promise<void | RouteView<A>> | void | RouteView<A>;
  onText?: (
    args: RouteActionArgs<A, P> & { text: string }
  ) => Promise<void | RouteView<A>> | void | RouteView<A>;
  showCancelOnWait?: boolean;
};

export type RouteNode<A = unknown> = {
  route: Route<A, any>;
  hasBack?: boolean;
  children?: Array<RouteNode<A> | Route<A, any>>;
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

import type { StateStore, TokenStore } from './stores';

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
};

export interface RunningRouter<A = unknown> {
  onText(fn: (ctx: Context) => Promise<void> | void): void;
  navigate(
    ctx: Context,
    route: Route<A, unknown>,
    params?: unknown
  ): Promise<void>;
  navigateBack(ctx: Context): Promise<void>;
}
