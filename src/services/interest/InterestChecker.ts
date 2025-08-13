import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import { AI_SERVICE_ID, AIService, ChatMessage } from '../ai/AIService';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { MESSAGE_SERVICE_ID, MessageService } from '../messages/MessageService';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService';

export interface InterestChecker {
  check(
    chatId: number
  ): Promise<{ interested: boolean; messageId: string | null } | null>;
}

export const INTEREST_CHECKER_ID = Symbol.for(
  'InterestChecker'
) as ServiceIdentifier<InterestChecker>;

@injectable()
export class DefaultInterestChecker implements InterestChecker {
  private readonly interval: number;

  constructor(
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.interval = envService.env.INTEREST_MESSAGE_INTERVAL;
  }

  async check(
    chatId: number
  ): Promise<{ interested: boolean; messageId: string | null } | null> {
    const count = await this.messages.getCount(chatId);
    if (count % this.interval !== 0) {
      return null;
    }

    const history: ChatMessage[] = await this.messages.getLastMessages(
      chatId,
      this.interval
    );
    const summary = (await this.summaries.getSummary(chatId)) || '';
    const result = await this.ai.checkInterest(history, summary);
    if (!result) {
      return { interested: false, messageId: null };
    }
    return { interested: true, messageId: result.messageId };
  }
}
