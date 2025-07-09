import { Telegraf, Context } from 'telegraf';
import { AIService } from '../services/AIService';
import { ChatMemoryManager } from '../services/ChatMemory';
import { DialogueManager } from '../services/DialogueManager';
import { MentionTrigger } from '../triggers/MentionTrigger';
import { ReplyTrigger } from '../triggers/ReplyTrigger';
import { NameTrigger } from '../triggers/NameTrigger';
import { KeywordTrigger } from '../triggers/KeywordTrigger';
import { TriggerContext } from '../triggers/Trigger';

export class TelegramBot {
  private bot: Telegraf;
  private dialogue = new DialogueManager(60 * 1000);
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger = new NameTrigger('Карл');
  private keywordTrigger = new KeywordTrigger('keywords.txt');

  constructor(token: string, private ai: AIService, private memories: ChatMemoryManager) {
    this.bot = new Telegraf(token);
    this.configure();
  }

  private configure() {
    this.bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

    this.bot.command('reset', async (ctx) => {
      await this.memories.reset(ctx.chat.id);
      ctx.reply('Контекст диалога сброшен!');
    });

    this.bot.on('text', (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat!.id as number;
    const reply = (ctx.message as any).reply_to_message as any;
    let replyText = '';
    if (reply) {
      if (typeof reply.text === 'string') {
        replyText += `Текст пользователя на сообщение: "${reply.text}"`;
      }
      if (typeof reply.caption === 'string') {
        if (replyText) {
          replyText += '; ';
        }
        replyText += `Содержимое сообщения: "${reply.caption}"`;
      }
    }

    const context: TriggerContext = {
      text: (ctx.message as any).text as string,
      replyText,
      chatId,
    };

    const inDialogue = this.dialogue.isActive(chatId);

    let matched = false;
    const triggers = [
      this.mentionTrigger,
      this.replyTrigger,
      this.nameTrigger,
    ];

    for (const trigger of triggers) {
      if (trigger.matches(ctx)) {
        matched = trigger.apply(ctx, context, this.dialogue) || matched;
      }
    }

    if (!matched && !inDialogue) {
      if (this.keywordTrigger.matches(ctx)) {
        matched = this.keywordTrigger.apply(ctx, context, this.dialogue) || matched;
      } else {
        return;
      }
    } else if (!matched && inDialogue) {
      this.dialogue.extend(chatId);
    }

    await ctx.sendChatAction('typing');

    const memory = this.memories.get(chatId);

    let userPrompt = '';
    if (context.replyText) {
      userPrompt += `${context.replyText}; `;
    }
    userPrompt += `Сообщение пользователя: "${context.text}";`;

    await memory.addMessage('user', userPrompt);

    const answer = await this.ai.ask(await memory.getHistory(), await memory.getSummary());
    await memory.addMessage('assistant', answer);

    ctx.reply(answer, { reply_parameters: { message_id: (ctx.message as any).message_id } });
  }

  public launch() {
    this.bot.launch();
  }

  public stop(reason: string) {
    this.bot.stop(reason);
  }
}
