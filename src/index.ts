import { config } from 'dotenv';
import { Telegraf } from 'telegraf';
import { askChatGPT } from './chatgpt';

config();

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Привет! Я Аркадий.')); 

bot.on('text', async (ctx) => {
  const mention = `@${ctx.me}`;
  const isMentioned = ctx.message.text.includes(mention);
  const isReply = ctx.message.reply_to_message?.from?.username === ctx.me;
  if (isMentioned || isReply) {
    const text = ctx.message.text.replace(mention, '').trim();
    const answer = await askChatGPT(text);
    ctx.reply(answer, { reply_parameters: { message_id: ctx.message.message_id } });
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
