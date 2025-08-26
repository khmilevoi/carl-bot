import { inject, injectable, type ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { TriggerReason } from '@/domain/triggers/Trigger';

import {
  PROMPT_BUILDER_FACTORY_ID,
  type PromptBuilderFactory,
} from './PromptBuilder';

@injectable()
export class PromptDirector {
  constructor(
    @inject(PROMPT_BUILDER_FACTORY_ID)
    private readonly builderFactory: PromptBuilderFactory
  ) {}

  async createAnswerPrompt(
    history: ChatMessage[],
    summary?: string,
    trigger?: TriggerReason
  ): Promise<string> {
    return this.builderFactory()
      .addPersona()
      .addPriorityRulesSystem()
      .addUserPromptSystem()
      .addAskSummary(summary)
      .addReplyTrigger(trigger?.why, trigger?.message)
      .addChatUsers(this.extractChatUsers(history))
      .addMessages(history)
      .build();
  }

  async createSummaryPrompt(
    history: ChatMessage[],
    previousSummary?: string
  ): Promise<string> {
    return this.builderFactory()
      .addSummarizationSystem()
      .addPreviousSummary(previousSummary)
      .addMessages(history)
      .build();
  }

  private extractChatUsers(
    history: ChatMessage[]
  ): { username: string; fullName: string; attitude: string }[] {
    const infoMap = new Map<string, { fullName: string; attitude: string }>();
    for (const m of history) {
      if (m.role === 'user' && m.username && m.attitude) {
        if (!infoMap.has(m.username)) {
          const parts = [m.firstName, m.lastName].filter(Boolean).join(' ');
          const fullName = m.fullName ?? (parts !== '' ? parts : 'N/A');
          infoMap.set(m.username, { fullName, attitude: m.attitude });
        }
      }
    }
    return Array.from(infoMap, ([username, v]) => ({
      username,
      fullName: v.fullName,
      attitude: v.attitude,
    }));
  }
}

export const PROMPT_DIRECTOR_ID = Symbol.for(
  'PromptDirector'
) as ServiceIdentifier<PromptDirector>;
