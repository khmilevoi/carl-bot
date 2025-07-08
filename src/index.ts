import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { askChatGPT, loadPersona } from './chatgpt';

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

// Хранилище истории сообщений для каждого чата
const chatHistories = new Map<number, Array<{ role: 'user' | 'assistant', content: string }>>();

bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

bot.command('reset', (ctx) => {
  chatHistories.delete(ctx.chat.id);
  ctx.reply('Контекст диалога сброшен!');
});

bot.on('text', async (ctx) => {
  const mention = `@${ctx.me}`;
  const nameMention = /^Карл[,:\s]/i;

  console.log(ctx.message);

  const isMentioned = ctx.message.text.includes(mention);
  const isNameMentioned = nameMention.test(ctx.message.text);
  const isReply = ctx.message.reply_to_message?.from?.username === ctx.me;
  if (isMentioned || isReply || isNameMentioned) {
    let text = ctx.message.text.replace(mention, '').trim();
    if (isNameMentioned) {
      text = text.replace(nameMention, '').trim();
    }
    let replyText = '';
    if (
      ctx.message.reply_to_message &&
      // @ts-ignore: text may not exist on all types, but we check for its presence
      typeof ctx.message.reply_to_message.text === 'string'
    ) {
      // @ts-ignore
      replyText = ctx.message.reply_to_message.text;
    }

    // Получаем историю для чата
    const chatId = ctx.chat.id;
    let history = chatHistories.get(chatId) || [];
    // Добавляем сообщение пользователя
    let userPrompt = text;
    if (replyText) {
      userPrompt = `В ответ на сообщение: "${replyText}"\n${text}`;
    }
    history.push({ role: 'user', content: userPrompt });
    // Обрезаем историю до 10 последних сообщений
    if (history.length > 10) {
      history = history.slice(history.length - 10);
    }

    const answer = await askChatGPT(history);
    // Добавляем ответ бота в историю
    history.push({ role: 'assistant', content: answer });
    if (history.length > 10) {
      history = history.slice(history.length - 10);
    }
    chatHistories.set(chatId, history);

    ctx.reply(answer, { reply_parameters: { message_id: ctx.message.message_id } });
  }
});

async function start() {
  await loadPersona();
  bot.launch();
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
