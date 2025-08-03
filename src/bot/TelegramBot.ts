import assert from 'node:assert';
import os from 'node:os';

import { injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { AIService } from '@/services/ai/AIService';
import { ChatFilter } from '@/services/chat/ChatFilter';
import { ChatMemoryManager } from '@/services/chat/ChatMemory';
import { DialogueManager } from '@/services/chat/DialogueManager';
import logger from '@/services/logging/logger';
import { MentionTrigger } from '@/triggers/MentionTrigger';
import { NameTrigger } from '@/triggers/NameTrigger';
import { ReplyTrigger } from '@/triggers/ReplyTrigger';
import { StemDictTrigger } from '@/triggers/StemDictTrigger';
import { TriggerContext } from '@/triggers/Trigger';

async function withTyping(ctx: Context, fn: () => Promise<void>) {
  await ctx.sendChatAction('typing');

  const timer = setInterval(() => {
    ctx.telegram.sendChatAction(ctx.chat!.id, 'typing').catch(() => {});
  }, 4000);

  try {
    await fn();
  } finally {
    clearInterval(timer);
  }
}

@injectable()
export class TelegramBot {
  private bot: Telegraf;
  private dialogue = new DialogueManager(60 * 1000);
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger = new NameTrigger('Карл');
  private keywordTrigger = new StemDictTrigger('keywords.json');
  private db: Promise<Database>;

  constructor(
    token: string,
    private ai: AIService,
    private memories: ChatMemoryManager,
    private filter: ChatFilter
  ) {
    this.bot = new Telegraf(token);
    this.configure();
    this.db = open({ filename: 'memory.db', driver: sqlite3.Database });
  }

  private configure() {
    this.bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

    this.bot.command('reset', async (ctx) => {
      await this.memories.reset(ctx.chat.id);
      ctx.reply('Контекст диалога сброшен!');
    });

    this.bot.command('ping', (ctx) => ctx.reply('pong'));

    this.bot.command('dump', async (ctx) => {
      if (!ctx.chat) return;
      await this.addAwaitingExport(ctx.chat.id);
      ctx.reply('Введите ключ доступа:');
    });

    this.bot.on(message('text'), (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    logger.debug({ chatId }, 'Received text message');

    if (await this.isAwaitingExport(chatId)) {
      await this.removeAwaitingExport(chatId);
      const key = process.env.DB_EXPORT_KEY;
      if (!key) {
        ctx.reply('Ключ не настроен');
        return;
      }
      if (ctx.message && 'text' in ctx.message && ctx.message.text === key) {
        try {
          const files = await this.exportDb();
          for (const file of files) {
            await ctx.replyWithDocument({
              source: file.buffer,
              filename: file.name,
            });
          }
        } catch (err) {
          logger.error({ err }, 'Failed to export database');
          ctx.reply('Не удалось выгрузить данные.');
        }
      } else {
        ctx.reply('Неверный ключ');
      }
      return;
    }

    if (!this.filter.isAllowed(chatId)) {
      logger.warn({ chatId }, 'Unauthorized chat access attempt');
      ctx.reply('Этот чат не находится в списке разрешённых.');
      return;
    }

    const message = ctx.message as any;
    assert(message && typeof message.text === 'string', 'Нет текста сообщения');

    let replyText: string | undefined;
    let replyUsername: string | undefined;
    let quoteText: string | undefined;
    if (message.reply_to_message) {
      const pieces: string[] = [];
      if (typeof message.reply_to_message.text === 'string') {
        pieces.push(message.reply_to_message.text);
      }
      if (typeof message.reply_to_message.caption === 'string') {
        pieces.push(message.reply_to_message.caption);
      }
      assert(pieces.length > 0, 'Нет текста или подписи в reply_to_message');
      replyText = pieces.join('; ');

      const from = message.reply_to_message.from;
      if (from) {
        if (from.first_name && from.last_name) {
          replyUsername = from.first_name + ' ' + from.last_name;
        } else {
          replyUsername = from.first_name || from.username || undefined;
        }
      }
    }

    if (message.quote && typeof message.quote.text === 'string') {
      quoteText = message.quote.text;
    }

    const context: TriggerContext = {
      text: `${message.text};`,
      replyText: replyText ?? '',
      chatId,
    };

    const inDialogue = this.dialogue.isActive(chatId);
    logger.debug({ chatId, inDialogue }, 'Checking triggers');

    let matched = false;
    matched = this.mentionTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.replyTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.nameTrigger.apply(ctx, context, this.dialogue) || matched;

    if (matched && !inDialogue) {
      this.dialogue.start(chatId);
    } else if (!matched && inDialogue) {
      this.dialogue.extend(chatId);
    }

    if (!matched) {
      if (
        !this.keywordTrigger.apply(ctx, context, this.dialogue) ||
        inDialogue
      ) {
        logger.debug({ chatId }, 'No trigger matched');
        return;
      }
    }

    await withTyping(ctx, async () => {
      logger.debug({ chatId }, 'Generating answer');

      const memory = this.memories.get(chatId);

      const username = ctx.from?.username || 'Имя неизвестно';
      const fullName =
        ctx.from?.first_name && ctx.from?.last_name
          ? ctx.from.first_name + ' ' + ctx.from.last_name
          : ctx.from?.first_name || ctx.from?.last_name || username;

      await memory.addMessage(
        'user',
        message.text,
        username,
        fullName,
        replyText,
        replyUsername,
        quoteText
      );

      const answer = await this.ai.ask(
        await memory.getHistory(),
        await memory.getSummary()
      );
      logger.debug({ chatId }, 'Answer generated');
      await memory.addMessage('assistant', answer, ctx.me);

      ctx.reply(answer, {
        reply_parameters: ctx.message?.message_id
          ? { message_id: ctx.message?.message_id }
          : undefined,
      });
      logger.debug({ chatId }, 'Reply sent');
    });
  }

  private async addAwaitingExport(chatId: number) {
    const db = await this.db;
    await db.run(
      'INSERT OR IGNORE INTO awaiting_export (chat_id) VALUES (?)',
      chatId
    );
  }

  private async isAwaitingExport(chatId: number) {
    const db = await this.db;
    const row = await db.get<{ chat_id: number }>(
      'SELECT chat_id FROM awaiting_export WHERE chat_id = ?',
      chatId
    );
    return !!row;
  }

  private async removeAwaitingExport(chatId: number) {
    const db = await this.db;
    await db.run('DELETE FROM awaiting_export WHERE chat_id = ?', chatId);
  }

  private async exportDb() {
    const db = await this.db;
    const tables = await db.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const files: { name: string; buffer: Buffer }[] = [];
    for (const { name } of tables) {
      const columnsInfo = await db.all<{ name: string }[]>(
        `PRAGMA table_info(${name})`
      );
      const columns = columnsInfo.map((c) => c.name);
      const rows = await db.all<any[]>(`SELECT * FROM ${name}`);
      const csvLines: string[] = [];
      csvLines.push(columns.join(','));
      for (const row of rows) {
        csvLines.push(
          columns.map((c) => JSON.stringify(row[c] ?? '')).join(',')
        );
      }
      const buffer = Buffer.from(csvLines.join(os.EOL));
      files.push({ name: `${name}.csv`, buffer });
    }
    return files;
  }

  public async launch() {
    logger.info('Launching bot');
    if (process.env.NODE_ENV === 'production') {
      assert(process.env.DOMAIN, 'Environment variable DOMAIN is not set');
      assert(process.env.PORT, 'Environment variable PORT is not set');
      await this.bot.launch({
        webhook: {
          domain: process.env.DOMAIN,
          port: Number(process.env.PORT),
        },
      });
    } else {
      await this.bot.launch();
    }
    logger.info('Bot launched');
  }

  public stop(reason: string) {
    logger.info({ reason }, 'Stopping bot');
    this.bot.stop(reason);
  }
}
