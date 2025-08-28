import type { StateStore, TokenStore } from './stores';
import { InMemoryStateStore, InMemoryTokenStore } from './stores';
import type { StartOptions } from './types';

export type ResolvedOptions = Required<
  Omit<StartOptions, 'onError' | 'stateStore' | 'tokenStore'>
> & {
  onError?: StartOptions['onError'];
  stateStore: StateStore;
  tokenStore: TokenStore;
};

export const DEFAULTS: ResolvedOptions = {
  inputPrompt: 'Введите текст для ввода',
  backLabel: '⬅️ Назад',
  backCallbackData: '__router_back__',
  renderMode: 'smart',
  onEditFail: 'reply',
  errorRenderMode: 'append',
  errorPrefix: 'Ошибка: ',
  cancelLabel: '✖️ Отмена',
  cancelCallbackData: '__router_cancel__',
  cancelCommands: ['/cancel', 'cancel', 'отмена'],
  showCancelOnWait: true,
  cbVersion: 'v1',
  onError: undefined,
  stateStore: new InMemoryStateStore(),
  tokenStore: new InMemoryTokenStore(),
  maxMessages: 10,
};
