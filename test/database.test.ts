import { describe, expect, it } from 'vitest';

import { parseDatabaseUrl } from '../src/utils/database';

describe('parseDatabaseUrl', () => {
  it('returns path without file:// prefix', () => {
    expect(parseDatabaseUrl('file:///tmp/db.sqlite')).toBe('/tmp/db.sqlite');
  });

  it('returns path as-is when no prefix is provided', () => {
    expect(parseDatabaseUrl('/tmp/db.sqlite')).toBe('/tmp/db.sqlite');
  });

  it('trims surrounding whitespace', () => {
    expect(parseDatabaseUrl('  file:///tmp/db.sqlite  ')).toBe(
      '/tmp/db.sqlite'
    );
  });

  it('throws when URL is undefined or empty', () => {
    expect(() => parseDatabaseUrl(undefined)).toThrow(
      'DATABASE_URL environment variable is required'
    );
    expect(() => parseDatabaseUrl('')).toThrow(
      'DATABASE_URL environment variable is required'
    );
  });
});
