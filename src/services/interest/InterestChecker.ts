import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import {
  AI_SERVICE_ID,
  AIService,
  ChatMessage,
} from '../ai/AIService.interface';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import {
  MESSAGE_SERVICE_ID,
  MessageService,
} from '../messages/MessageService.interface';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService.interface';

export interface InterestChecker {
  check(
    chatId: number
  ): Promise<{ messageId: string; message: string; why: string } | null>;
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
  ): Promise<{ messageId: string; message: string; why: string } | null> {
    const count = await this.messages.getCount(chatId);
    if (count % this.interval !== 0) {
      return null;
    }

    const history: ChatMessage[] = await this.messages.getLastMessages(
      chatId,
      this.interval
    );
    const summary = (await this.summaries.getSummary(chatId)) ?? '';
    const result = await this.ai.checkInterest(history, summary);
    if (result == null) {
      return null;
    }
    const msg =
      history.find((m) => m.messageId?.toString() === result.messageId)
        ?.content ?? '';
    return { ...result, message: msg };
  }
}
