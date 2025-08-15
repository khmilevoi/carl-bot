import { describe, expect, it, vi } from 'vitest';

import { createWindows } from '../../src/bot/windowConfig';

describe('windowConfig', () => {
  it('handles missing chats data', async () => {
    const windows = createWindows({
      exportData: vi.fn(),
      resetMemory: vi.fn(),
      requestChatAccess: vi.fn(),
      requestUserAccess: vi.fn(),
      showAdminChats: vi.fn(),
    });

    const adminChats = windows.find((w) => w.id === 'admin_chats');
    if (!adminChats) throw new Error('route not found');

    const { text, buttons } = await adminChats.build({
      loadData: async () => undefined,
    });

    expect(text).toBe('Нет доступных чатов');
    expect(buttons).toEqual([]);
  });
});
