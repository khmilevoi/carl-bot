import crypto from 'node:crypto';

import { Context } from 'telegraf';

export type RouterApi<T extends Record<string, unknown>> = {
  show: (ctx: Context, id: string) => Promise<void>;
} & T;

interface ButtonDescriptor<T extends Record<string, unknown>> {
  text: string;
  callback: string;
  handler: (api: RouterApi<T>, ctx: Context) => Promise<void> | void;
}

interface RouteBuildResult<T extends Record<string, unknown>> {
  buttons: ButtonDescriptor<T>[];
}

export interface RouteDescriptor<T extends Record<string, unknown>> {
  id: string;
  text: string;
  build: (
    api: RouterApi<T>,
    ctx: Context
  ) => Promise<RouteBuildResult<T>> | RouteBuildResult<T>;
}

export function createButton<T extends Record<string, unknown>>(
  text: string,
  handler: (api: RouterApi<T>, ctx: Context) => Promise<void> | void
): ButtonDescriptor<T> {
  return { text, handler, callback: crypto.randomUUID() };
}

export function createRoute<T extends Record<string, unknown>>(
  id: string,
  text: string,
  builder: (
    api: RouterApi<T>,
    ctx: Context
  ) => Promise<RouteBuildResult<T>> | RouteBuildResult<T>
): RouteDescriptor<T> {
  return { id, text, build: builder };
}
