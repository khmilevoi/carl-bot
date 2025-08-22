import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { TriggerReason } from '../../../triggers/Trigger.interface';
import {
  AI_SERVICE_ID,
  AIService,
} from '../../interfaces/ai/AIService.interface';
import {
  CHAT_MEMORY_MANAGER_ID,
  ChatMemoryManager,
} from '../../interfaces/chat/ChatMemoryManager.interface';
import { type ChatResponder } from '../../interfaces/chat/ChatResponder.interface';
import type { Logger } from '../../interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../../interfaces/logging/LoggerFactory.interface';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../../interfaces/summaries/SummaryService.interface';
import { MessageFactory } from '../messages/MessageFactory';

@injectable()
export class DefaultChatResponder implements ChatResponder {
  private readonly logger: Logger;

  constructor(
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(CHAT_MEMORY_MANAGER_ID) private memories: ChatMemoryManager,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    this.logger = this.loggerFactory.create('DefaultChatResponder');
  }

  async generate(
    ctx: Context,
    chatId: number,
    triggerReason?: TriggerReason
  ): Promise<string> {
    const memory = await this.memories.get(chatId);
    const history = await memory.getHistory();
    const summary = await this.summaries.getSummary(chatId);
    const start = Date.now();
    const answer = await this.ai.ask(history, summary, triggerReason);
    const responseTimeMs = Date.now() - start;
    this.logger.debug(
      {
        chatId,
        historyLength: history.length,
        hasSummary: Boolean(summary),
        responseTimeMs,
      },
      'Generated chat response'
    );
    await memory.addMessage(MessageFactory.fromAssistant(ctx, answer));
    return answer;
  }
}
