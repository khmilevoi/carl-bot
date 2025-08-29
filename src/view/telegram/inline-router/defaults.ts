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
  inputPrompt: '������ �����:',
  backLabel: '?? �����',
  backCallbackData: '__router_back__',
  renderMode: 'smart',
  onEditFail: 'reply',
  errorRenderMode: 'append',
  errorPrefix: '?? ',
  cancelLabel: '?? �⬥��',
  cancelCallbackData: '__router_cancel__',
  cancelCommands: ['/cancel', '�⬥��', '�⬥��'],
  showCancelOnWait: true,
  cbVersion: 'v1',
  onError: undefined,
  stateStore: new InMemoryStateStore(),
  tokenStore: new InMemoryTokenStore(),
  maxMessages: 10,
  commands: [],
  commandsExtra: {},
};
