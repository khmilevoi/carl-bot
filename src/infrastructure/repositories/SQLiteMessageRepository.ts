import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';

import type { ChatMessage } from '../../application/interfaces/ai/AIService.interface';
import type { StoredMessage } from '../../application/interfaces/messages/StoredMessage.interface';
import type { MessageRepository } from '../../domain/repositories/MessageRepository.interface';
import { DB_PROVIDER_ID, type SQLiteDbProvider } from './DbProvider';

@injectable()
export class SQLiteMessageRepository implements MessageRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider) {}
  async insert({
    chatId,
    messageId,
    role,
    content,
    userId,
    replyText,
    replyUsername,
    quoteText,
  }: StoredMessage): Promise<void> {
    const db = await this.db();
    await db.run(
      'INSERT INTO messages (chat_id, message_id, role, content, user_id, reply_text, reply_username, quote_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      chatId,
      messageId ?? null,
      role,
      content,
      userId ?? 0,
      replyText ?? null,
      replyUsername ?? null,
      quoteText ?? null
    );
  }

  async findByChatId(chatId: number): Promise<ChatMessage[]> {
    const db = await this.db();
    const rows = await db.all<
      {
        role: 'user' | 'assistant';
        content: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        reply_text: string | null;
        reply_username: string | null;
        quote_text: string | null;
        user_id: number | null;
        chat_id: number | null;
        message_id: number | null;
        attitude: string | null;
      }[]
    >(
      'SELECT m.role, m.content, u.username, u.first_name, u.last_name, u.attitude, m.reply_text, m.reply_username, m.quote_text, m.user_id, c.chat_id, m.message_id FROM messages m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN chats c ON m.chat_id = c.chat_id WHERE m.chat_id = ? ORDER BY m.id',
      chatId
    );
    return (
      rows?.map((r) => {
        const entry: ChatMessage = {
          role: r.role,
          content: r.content,
          chatId: r.chat_id ?? undefined,
        };
        if (r.username) entry.username = r.username;
        const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ');
        if (fullName) entry.fullName = fullName;
        if (r.reply_text) entry.replyText = r.reply_text;
        if (r.reply_username) entry.replyUsername = r.reply_username;
        if (r.quote_text) entry.quoteText = r.quote_text;
        if (r.user_id) entry.userId = r.user_id;
        if (r.message_id) entry.messageId = r.message_id;
        if (r.attitude) entry.attitude = r.attitude;
        return entry;
      }) ?? []
    );
  }

  async countByChatId(chatId: number): Promise<number> {
    const db = await this.db();
    const row = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages WHERE chat_id = ?',
      chatId
    );
    return row?.count ?? 0;
  }

  async findLastByChatId(
    chatId: number,
    limit: number
  ): Promise<ChatMessage[]> {
    const db = await this.db();
    const rows = await db.all<
      {
        role: 'user' | 'assistant';
        content: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        reply_text: string | null;
        reply_username: string | null;
        quote_text: string | null;
        user_id: number | null;
        chat_id: number | null;
        message_id: number | null;
        attitude: string | null;
      }[]
    >(
      'SELECT m.role, m.content, u.username, u.first_name, u.last_name, u.attitude, m.reply_text, m.reply_username, m.quote_text, m.user_id, c.chat_id, m.message_id FROM messages m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN chats c ON m.chat_id = c.chat_id WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT ?',
      chatId,
      limit
    );
    return (
      rows?.map((r) => {
        const entry: ChatMessage = {
          role: r.role,
          content: r.content,
          chatId: r.chat_id ?? undefined,
        };
        if (r.username) entry.username = r.username;
        const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ');
        if (fullName) entry.fullName = fullName;
        if (r.reply_text) entry.replyText = r.reply_text;
        if (r.reply_username) entry.replyUsername = r.reply_username;
        if (r.quote_text) entry.quoteText = r.quote_text;
        if (r.user_id) entry.userId = r.user_id;
        if (r.message_id) entry.messageId = r.message_id;
        if (r.attitude) entry.attitude = r.attitude;
        return entry;
      }) ?? []
    );
  }

  async clearByChatId(chatId: number): Promise<void> {
    const db = await this.db();
    await db.run('DELETE FROM messages WHERE chat_id = ?', chatId);
  }

  private async db(): Promise<Database> {
    return this.dbProvider.get();
  }
}
