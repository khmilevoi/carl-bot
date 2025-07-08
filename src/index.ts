import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import { SQLiteMemoryStorage } from './services/MemoryStorage';
import { DialogueManager } from './services/DialogueManager';
import { MentionTrigger } from './triggers/MentionTrigger';
import { ReplyTrigger } from './triggers/ReplyTrigger';
import { NameTrigger } from './triggers/NameTrigger';
import { KeywordTrigger } from './triggers/KeywordTrigger';

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

const gpt = new ChatGPTService(apiKey);
const storage = new SQLiteMemoryStorage();
const memories = new ChatMemoryManager(gpt, storage, 20);
const bot = new Telegraf(token);
const dialogue = new DialogueManager(15 * 1000);
const mentionTrigger = new MentionTrigger();
const replyTrigger = new ReplyTrigger();
const nameTrigger = new NameTrigger('Карл');
const keywordTrigger = new KeywordTrigger('keywords.txt');

bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

bot.command('reset', async (ctx) => {
  await memories.reset(ctx.chat.id);
  ctx.reply('Контекст диалога сброшен!');
});

bot.on('text', async (ctx) => {
  const isMentioned = mentionTrigger.matches(ctx);
  const isReply = replyTrigger.matches(ctx);
  const isNameMentioned = nameTrigger.matches(ctx);
  const chatId = ctx.chat.id;
  const inDialogue = dialogue.isActive(chatId);

  if (!(isMentioned || isReply || isNameMentioned || inDialogue)) {
    if (!keywordTrigger.matches(ctx)) {
      return;
    }
  }

  await ctx.sendChatAction('typing');

  let text = ctx.message.text;
  if (isMentioned) {
    text = text.replace(`@${ctx.me}`, '').trim();
  }
  if (isNameMentioned) {
    text = text.replace(/^Карл[,:\s]/i, '').trim();
  }
  let replyText = '';
  if (
    ctx.message.reply_to_message &&
    // @ts-ignore
    typeof ctx.message.reply_to_message.text === 'string'
  ) {
    // @ts-ignore
    replyText = ctx.message.reply_to_message.text;
  }

  if (isMentioned || isReply || isNameMentioned) {
    dialogue.start(chatId);
  } else if (inDialogue) {
    dialogue.extend(chatId);
  }
  const memory = memories.get(chatId);

  let userPrompt = '';
  if (replyText) {
    userPrompt += `Пользователь ответил на это сообщение: "${replyText}";`;
  }

  userPrompt += `Сообщение пользователя: "${text}";`;

  await memory.addMessage('user', userPrompt);

  const answer = await gpt.ask(await memory.getHistory(), await memory.getSummary());
  await memory.addMessage('assistant', answer);

  ctx.reply(answer, { reply_parameters: { message_id: ctx.message.message_id } });
});

async function start() {
  bot.launch();
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
