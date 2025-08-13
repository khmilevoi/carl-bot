import { describe, expect, it, vi } from 'vitest';

import type { ChatApprovalService } from '../src/services/chat/ChatApprovalService';
import {
  ChatApprovalChatFilter,
  type ChatFilter,
} from '../src/services/chat/ChatFilter';

describe('ChatApprovalChatFilter', () => {
  it('allows only approved chat IDs and requests approval for pending ones', async () => {
    const service: ChatApprovalService = {
      request: vi.fn().mockResolvedValue(undefined),
      approve: vi.fn(),
      ban: vi.fn(),
      unban: vi.fn(),
      getStatus: vi.fn(async (id: number) =>
        id === 100 ? 'approved' : 'pending'
      ),
    };

    const filter: ChatFilter = new ChatApprovalChatFilter(service);

    expect(await filter.isAllowed(100)).toBe(true);
    expect(await filter.isAllowed(200)).toBe(false);
    expect(service.request).toHaveBeenCalledWith(200);
    expect(service.request).not.toHaveBeenCalledWith(100);
  });

  it('blocks banned chats without requesting access', async () => {
    const service: ChatApprovalService = {
      request: vi.fn(),
      approve: vi.fn(),
      ban: vi.fn(),
      unban: vi.fn(),
      getStatus: vi.fn(async () => 'banned'),
    };

    const filter: ChatFilter = new ChatApprovalChatFilter(service);

    expect(await filter.isAllowed(300)).toBe(false);
    expect(service.request).not.toHaveBeenCalled();
  });
});
