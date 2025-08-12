import { describe, expect, it } from 'vitest';

import { parseDatabaseUrl } from '../src/utils/database';

describe('parseDatabaseUrl', () => {
  it('returns path without file:// prefix', () => {
    expect(parseDatabaseUrl('file:///tmp/db.sqlite')).toBe('/tmp/db.sqlite');
  });

  it('throws when URL is undefined', () => {
    expect(() => parseDatabaseUrl(undefined)).toThrow();
  });
});
