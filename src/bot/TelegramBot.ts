import assert from 'node:assert';

import { Context, Telegraf } from 'telegraf';

import { AIService } from '../services/AIService';
import { ChatMemoryManager } from '../services/ChatMemory';
import { DialogueManager } from '../services/DialogueManager';
import { KeywordTrigger } from '../triggers/KeywordTrigger';
import { MentionTrigger } from '../triggers/MentionTrigger';
import { NameTrigger } from '../triggers/NameTrigger';
import { ReplyTrigger } from '../triggers/ReplyTrigger';
import { TriggerContext } from '../triggers/Trigger';

export class TelegramBot {
  private bot: Telegraf;
  private dialogue = new DialogueManager(60 * 1000);
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger = new NameTrigger('Карл');
  private keywordTrigger = new KeywordTrigger('keywords.txt');

  constructor(
    token: string,
    private ai: AIService,
    private memories: ChatMemoryManager
  ) {
    this.bot = new Telegraf(token);
    this.configure();
  }

  private configure() {
    this.bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

    this.bot.command('reset', async (ctx) => {
      await this.memories.reset(ctx.chat.id);
      ctx.reply('Контекст диалога сброшен!');
    });

    this.bot.command('ping', (ctx) => ctx.reply('pong'));

    this.bot.on('text', (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');

    const message = ctx.message as any;
    assert(message && typeof message.text === 'string', 'Нет текста сообщения');

    let replyText = '';
    if (message.reply_to_message) {
      assert(
        typeof message.reply_to_message.text === 'string' ||
          typeof message.reply_to_message.caption === 'string',
        'Нет текста или подписи в reply_to_message'
      );
      replyText = `Пользователь ответил на: ${message.reply_to_message.text}; ${message.reply_to_message.caption}`;
    }

    const context: TriggerContext = {
      text: `${message.text};`,
      replyText,
      chatId,
    };

    const inDialogue = this.dialogue.isActive(chatId);

    let matched = false;
    matched = this.mentionTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.replyTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.nameTrigger.apply(ctx, context, this.dialogue) || matched;

    if (matched && !inDialogue) {
      this.dialogue.start(chatId);
    }

    if (!matched && !inDialogue) {
      if (!this.keywordTrigger.apply(ctx, context, this.dialogue)) {
        return;
      }
    } else if (!matched && inDialogue) {
      this.dialogue.extend(chatId);
    }

    await ctx.sendChatAction('typing');

    const memory = this.memories.get(chatId);

    let userPrompt = '';
    if (context.replyText) {
      userPrompt += `"${context.replyText}";`;
    }
    userPrompt += `Сообщение пользователя: "${context.text}";`;

    await memory.addMessage('user', userPrompt);

    const answer = await this.ai.ask(
      await memory.getHistory(),
      await memory.getSummary()
    );
    await memory.addMessage('assistant', answer);

    ctx.reply(answer, {
      reply_parameters: { message_id: (ctx.message as any).message_id },
    });
  }

  public async launch() {
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
  }

  public stop(reason: string) {
    this.bot.stop(reason);
  }
}
