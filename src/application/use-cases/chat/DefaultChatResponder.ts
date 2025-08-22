import { inject, injectable } from 'inversify';
import type { Context } from 'telegraf';

import type { AIService } from '@/application/interfaces/ai/AIService.interface';
import { AI_SERVICE_ID } from '@/application/interfaces/ai/AIService.interface';
import type { ChatMemoryManager } from '@/application/interfaces/chat/ChatMemoryManager.interface';
import { CHAT_MEMORY_MANAGER_ID } from '@/application/interfaces/chat/ChatMemoryManager.interface';
import { type ChatResponder } from '@/application/interfaces/chat/ChatResponder.interface';
import type { Logger } from '@/application/interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory.interface';
import type { SummaryService } from '@/application/interfaces/summaries/SummaryService.interface';
import { SUMMARY_SERVICE_ID } from '@/application/interfaces/summaries/SummaryService.interface';
import { MessageFactory } from '@/application/use-cases/messages/MessageFactory';
import type { TriggerReason } from '@/domain/triggers/Trigger.interface';

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
