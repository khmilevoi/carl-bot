import { describe, expect, it, vi } from 'vitest';

import { AdminServiceImpl } from '../src/services/admin/AdminServiceImpl';

describe('AdminServiceImpl', () => {
  it('exports chat messages, summaries and users', async () => {
    const messageRepo = {
      findByChatId: vi.fn(async () => [
        {
          role: 'user',
          content: 'hi',
          username: 'u',
          fullName: 'F',
          replyText: '',
          replyUsername: '',
          quoteText: '',
          userId: 1,
          messageId: 1,
          attitude: null,
          chatId: 123,
        },
      ]),
    };
    const summaryRepo = { findById: vi.fn(async () => 's') };
    const chatUserRepo = { listByChat: vi.fn(async () => [1]) };
    const userRepo = {
      findById: vi.fn(async () => ({
        id: 1,
        username: 'u',
        firstName: 'F',
        lastName: 'L',
        attitude: null,
      })),
    };
    const admin = new AdminServiceImpl(
      { get: vi.fn(), listTables: vi.fn() } as any,
      {} as any,
      messageRepo as any,
      summaryRepo as any,
      chatUserRepo as any,
      userRepo as any
    );
    const files = await admin.exportChatData(123);
    expect(files.map((f) => f.filename).sort()).toEqual([
      'messages.csv',
      'summaries.csv',
      'users.csv',
    ]);
    const users = files.find((f) => f.filename === 'users.csv');
    expect(users?.buffer.toString()).toContain(
      'id,username,firstName,lastName,attitude'
    );
    expect(users?.buffer.toString()).toContain('1');
  });
});
