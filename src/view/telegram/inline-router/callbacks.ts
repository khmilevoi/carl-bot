import type { TokenStore } from './stores';

export function cb(
  routeId: string,
  args: Array<string | number> = [],
  cbVersion = 'v1'
): string {
  const tail = args.length ? `:${args.join(':')}` : '';
  return `${routeId}!${cbVersion}${tail}`;
}

export function parseCb(data: string): {
  routeId: string;
  cbVersion?: string;
  args: string[];
  isToken: boolean;
  token?: string;
} {
  const [head, ...rest] = data.split(':');
  const [routeId, version] = head.split('!');
  if (!version) {
    return { routeId: head, cbVersion: undefined, args: rest, isToken: false };
  }
  if (rest[0] === 't') {
    return {
      routeId,
      cbVersion: version,
      args: rest.slice(1),
      isToken: true,
      token: rest[1],
    };
  }
  return { routeId, cbVersion: version, args: rest, isToken: false };
}

export async function cbTok<T>(
  routeId: string,
  tokenStore: TokenStore,
  payload: T,
  ttlMs = 10 * 60_000,
  cbVersion = 'v1'
): Promise<string> {
  const token = await tokenStore.save(payload, ttlMs);
  return `${routeId}!${cbVersion}:t:${token}`;
}
