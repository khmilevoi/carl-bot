import { type Container } from 'inversify';
import type { Context } from 'telegraf';

import {
  BOT_SERVICE_ID,
  type BotService,
} from '../application/interfaces/bot/BotService';
import { type Trigger, TRIGGER_ID } from '../domain/triggers/Trigger';
import { TelegramBot } from '../view/telegram/TelegramBot';
import { InterestTrigger } from '../view/telegram/triggers/InterestTrigger';
import { MentionTrigger } from '../view/telegram/triggers/MentionTrigger';
import { NameTrigger } from '../view/telegram/triggers/NameTrigger';
import { ReplyTrigger } from '../view/telegram/triggers/ReplyTrigger';

export const register = (container: Container): void => {
  container
    .bind<Trigger<Context>>(TRIGGER_ID)
    .to(MentionTrigger)
    .inSingletonScope();
  container
    .bind<Trigger<Context>>(TRIGGER_ID)
    .to(ReplyTrigger)
    .inSingletonScope();
  container
    .bind<Trigger<Context>>(TRIGGER_ID)
    .to(NameTrigger)
    .inSingletonScope();
  container
    .bind<Trigger<Context>>(TRIGGER_ID)
    .to(InterestTrigger)
    .inSingletonScope();

  container.bind(TelegramBot).toSelf().inSingletonScope();
  container.bind<BotService>(BOT_SERVICE_ID).toService(TelegramBot);
};
