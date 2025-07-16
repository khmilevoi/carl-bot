import assert from 'node:assert';

import { Api, TelegramClient } from 'telegram';
import { NewMessage } from 'telegram/events';
import { StringSession } from 'telegram/sessions';

import { AIService } from '../services/AIService';
import { ChatFilter } from '../services/ChatFilter';
import { ChatMemoryManager } from '../services/ChatMemory';
import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
import { KeywordTrigger } from '../triggers/KeywordTrigger';
import { MentionTrigger } from '../triggers/MentionTrigger';
import { NameTrigger } from '../triggers/NameTrigger';
import { ReplyTrigger } from '../triggers/ReplyTrigger';
import { MessageContext, TriggerContext } from '../triggers/Trigger';

export class TelegramClientApp {
  private client: TelegramClient;
  private me = '';
  private dialogue = new DialogueManager(60 * 1000);
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger = new NameTrigger('Карл');
  private keywordTrigger = new KeywordTrigger('keywords.txt');

  constructor(
    apiId: number,
    apiHash: string,
    session: string,
    private ai: AIService,
    private memories: ChatMemoryManager,
    private filter: ChatFilter
  ) {
    const stringSession = new StringSession(session);
    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
  }

  private async ensureConnected() {
    if (!this.client.connected) {
      logger.debug('Connecting Telegram client');
      await this.client.connect();
      const me = await this.client.getMe();
      this.me = (me as any).username ?? '';
    }
  }

  public async launch() {
    await this.ensureConnected();
    this.client.addEventHandler((e) => this.onMessage(e), new NewMessage({}));
    logger.info('Client launched');
  }

  public stop(reason: string) {
    logger.info({ reason }, 'Stopping client');
    void this.client.disconnect();
  }

  private async getMessage(
    chatId: number,
    messageId: number
  ): Promise<string | null> {
    const messages = await this.client.getMessages(chatId, {
      ids: [messageId],
    });
    const msg = messages[0] as Api.Message | undefined;
    return (msg as any)?.message ?? null;
  }

  private async onMessage(event: NewMessage.Event) {
    await this.ensureConnected();
    const message = event.message;
    if (!('message' in message) || !message.message) {
      return;
    }
    const chatId = message.chatId;
    assert(typeof chatId === 'number', 'No chat id');

    if (!this.filter.isAllowed(chatId)) {
      logger.warn({ chatId }, 'Попытка доступа из неразрешённого чата');
      await this.client.sendMessage(chatId, {
        message: 'Этот чат не находится в списке разрешённых.',
      });
      return;
    }

    const ctx: MessageContext = {
      text: message.message,
      me: this.me,
    };

    let replyText = '';
    if (message.replyToMsgId) {
      const msgs = await this.client.getMessages(chatId, {
        ids: [message.replyToMsgId],
      });
      const r = msgs[0] as Api.Message;
      const entity = await this.client.getEntity(r.fromId!);
      ctx.replyUsername = (entity as any).username;
      replyText = `Пользователь ответил на: ${r.message}`;
    }

    if (
      message.fwdFrom &&
      message.fwdFrom.fromId instanceof Api.PeerChannel &&
      message.fwdFrom.channelPost
    ) {
      try {
        const origin = await this.getMessage(
          message.fwdFrom.fromId.channelId,
          message.fwdFrom.channelPost
        );
        if (origin) {
          replyText += ` Оригинал: ${origin}`;
        }
      } catch (e) {
        logger.warn({ err: e }, 'Failed to load forwarded message');
      }
    }

    const context: TriggerContext = {
      text: ctx.text,
      replyText,
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

    await this.client.invoke(
      new Api.messages.SetTyping({
        peer: await this.client.getInputEntity(chatId),
        action: new Api.SendMessageTypingAction(),
      })
    );
    logger.debug({ chatId }, 'Generating answer');

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
    logger.debug({ chatId }, 'Answer generated');
    await memory.addMessage('assistant', answer);

    await this.client.sendMessage(chatId, {
      message: answer,
      replyTo: message.id,
    });
    logger.debug({ chatId }, 'Reply sent');
  }
}
