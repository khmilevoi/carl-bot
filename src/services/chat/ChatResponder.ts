import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { AI_SERVICE_ID, AIService } from '../ai/AIService';
import { MessageFactory } from '../messages/MessageFactory';
import { MESSAGE_SERVICE_ID, MessageService } from '../messages/MessageService';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService';

export interface ChatResponder {
  generate(ctx: Context, chatId: number): Promise<string>;
}

export const CHAT_RESPONDER_ID = Symbol.for(
  'ChatResponder'
) as ServiceIdentifier<ChatResponder>;

@injectable()
export class DefaultChatResponder implements ChatResponder {
  constructor(
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService
  ) {}

  async generate(ctx: Context, chatId: number): Promise<string> {
    const history = await this.messages.getMessages(chatId);
    const summary = await this.summaries.getSummary(chatId);
    const answer = await this.ai.ask(history, summary);
    await this.messages.addMessage(MessageFactory.fromAssistant(ctx, answer));
    return answer;
  }
}
