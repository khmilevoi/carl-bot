import { describe, expect, it } from 'vitest';

import {
  cb,
  parseCb,
  cbTok,
  InMemoryTokenStore,
} from '@/view/telegram/inline-router';

describe('callback DSL', () => {
  it('builds callback_data strings', () => {
    expect(cb('do')).toBe('do!v1');
    expect(cb('do', ['a', 1])).toBe('do!v1:a:1');
    expect(cb('do', ['x'], 'v2')).toBe('do!v2:x');
  });

  it('parses callback_data strings', () => {
    const parsed = parseCb('do!v1:a:1');
    expect(parsed).toEqual({
      routeId: 'do',
      cbVersion: 'v1',
      args: ['a', '1'],
      isToken: false,
    });

    const parsedNoVersion = parseCb('do:a');
    expect(parsedNoVersion).toEqual({
      routeId: 'do',
      cbVersion: undefined,
      args: ['a'],
      isToken: false,
    });
  });

  it('stores payload with cbTok and loads it by token', async () => {
    const tokenStore = new InMemoryTokenStore();
    const payload = { foo: 'bar' };
    const data = await cbTok('do', tokenStore, payload);
    const { token, isToken, cbVersion, routeId, args } = parseCb(data);
    expect(isToken).toBe(true);
    expect(routeId).toBe('do');
    expect(cbVersion).toBe('v1');
    expect(token).toBeDefined();
    expect(args).toEqual([token]);
    const loaded = tokenStore.load<typeof payload>(token!);
    expect(loaded).toEqual(payload);
  });
});
