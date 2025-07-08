import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

const gpt = new ChatGPTService(apiKey);
const memories = new ChatMemoryManager(gpt);
const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

bot.command('reset', (ctx) => {
  memories.reset(ctx.chat.id);
  ctx.reply('Контекст диалога сброшен!');
});

bot.on('text', async (ctx) => {
  const mention = `@${ctx.me}`;
  const nameMention = /^Карл[,:\s]/i;

  const isMentioned = ctx.message.text.includes(mention);
  const isNameMentioned = nameMention.test(ctx.message.text);
  const isReply = ctx.message.reply_to_message?.from?.username === ctx.me;
  if (!(isMentioned || isReply || isNameMentioned)) {
    return;
  }

  let text = ctx.message.text.replace(mention, '').trim();
  if (isNameMentioned) {
    text = text.replace(nameMention, '').trim();
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

  const chatId = ctx.chat.id;
  const memory = memories.get(chatId);

  let userPrompt = text;
  if (replyText) {
    userPrompt = `В ответ на сообщение: "${replyText}"\n${text}`;
  }
  await memory.addMessage('user', userPrompt);

  const answer = await gpt.ask(memory.getHistory(), memory.getSummary());
  await memory.addMessage('assistant', answer);

  ctx.reply(answer, { reply_parameters: { message_id: ctx.message.message_id } });
});

async function start() {
  bot.launch();
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
