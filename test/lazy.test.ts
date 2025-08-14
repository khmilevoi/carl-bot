import { describe, expect, it, vi } from 'vitest';

import { createLazy } from '../src/utils/lazy';

describe('createLazy', () => {
  it('caches successful results', async () => {
    const loader = vi.fn().mockResolvedValue(1);
    const lazy = createLazy(loader);

    await expect(lazy()).resolves.toBe(1);
    await expect(lazy()).resolves.toBe(1);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries loading after failure', async () => {
    const loader = vi
      .fn<[], Promise<number>>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(2);

    const lazy = createLazy(loader);

    await expect(lazy()).rejects.toThrow('fail');
    await expect(lazy()).resolves.toBe(2);

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
