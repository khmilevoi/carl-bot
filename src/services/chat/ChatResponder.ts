import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { TriggerReason } from '../../triggers/Trigger.interface';
import { AI_SERVICE_ID, AIService } from '../ai/AIService.interface';
import { MessageFactory } from '../messages/MessageFactory';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService.interface';
import { ChatMemoryManager } from './ChatMemory';

export interface ChatResponder {
  generate(
    ctx: Context,
    chatId: number,
    triggerReason?: TriggerReason
  ): Promise<string>;
}

export const CHAT_RESPONDER_ID = Symbol.for(
  'ChatResponder'
) as ServiceIdentifier<ChatResponder>;

@injectable()
export class DefaultChatResponder implements ChatResponder {
  constructor(
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(ChatMemoryManager) private memories: ChatMemoryManager,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService
  ) {}

  async generate(
    ctx: Context,
    chatId: number,
    triggerReason?: TriggerReason
  ): Promise<string> {
    const memory = this.memories.get(chatId);
    const history = await memory.getHistory();
    const summary = await this.summaries.getSummary(chatId);
    const answer = await this.ai.ask(history, summary, triggerReason);
    await memory.addMessage(MessageFactory.fromAssistant(ctx, answer));
    return answer;
  }
}
