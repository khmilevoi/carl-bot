import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { JSONWhiteListChatFilter } from '../src/services/chat/ChatFilter';
import { TestEnvService } from '../src/services/env/EnvService';

describe('JSONWhiteListChatFilter', () => {
  it('allows only whitelisted chat IDs', () => {
    const allowedIds = [100, 200];
    const file = join(tmpdir(), `whitelist-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(allowedIds), 'utf-8');

    const env = new TestEnvService();
    vi.spyOn(env, 'getWhitelistFile').mockReturnValue(file);

    const filter = new JSONWhiteListChatFilter(env);

    expect(filter.isAllowed(100)).toBe(true);
    expect(filter.isAllowed(200)).toBe(true);
    expect(filter.isAllowed(300)).toBe(false);
  });
});
