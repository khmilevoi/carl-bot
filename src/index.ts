import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { askChatGPT, loadPersona } from './chatgpt';

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Привет! Я Аркадий.'));

bot.on('text', async (ctx) => {
  const mention = `@${ctx.me}`;
  const nameMention = /^Аркадий[,:\s]/i;

  console.log(ctx.message);

  const isMentioned = ctx.message.text.includes(mention);
  const isNameMentioned = nameMention.test(ctx.message.text);
  const isReply = ctx.message.reply_to_message?.from?.username === ctx.me;
  if (isMentioned || isReply || isNameMentioned) {
    let text = ctx.message.text.replace(mention, '').trim();
    if (isNameMentioned) {
      text = text.replace(nameMention, '').trim();
    }
    const answer = await askChatGPT(text);
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
