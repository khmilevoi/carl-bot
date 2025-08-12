import { inject, injectable } from 'inversify';

import type { ChatMessage } from '../../services/ai/AIService';
import type { StoredMessage } from '../../services/messages/StoredMessage';
import { DB_PROVIDER_ID, type SQLiteDbProvider } from '../DbProvider';
import { type MessageRepository } from '../interfaces/MessageRepository';

@injectable()
export class SQLiteMessageRepository implements MessageRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider) {}

  private async db() {
    return this.dbProvider.get();
  }

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
      }[]
    >(
      'SELECT m.role, m.content, u.username, u.first_name, u.last_name, m.reply_text, m.reply_username, m.quote_text, m.user_id, c.chat_id, m.message_id FROM messages m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN chats c ON m.chat_id = c.chat_id WHERE m.chat_id = ? ORDER BY m.id',
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
        return entry;
      }) ?? []
    );
  }

  async clearByChatId(chatId: number): Promise<void> {
    const db = await this.db();
    await db.run('DELETE FROM messages WHERE chat_id = ?', chatId);
  }
}
