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
    const builder = this.builderFactory();
    builder.addPersona().addPriorityRulesSystem().addUserPromptSystem();

    if (summary) {
      builder.addAskSummary(summary);
    }
    if (trigger) {
      builder.addReplyTrigger(trigger.why, trigger.message);
    }

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
    const infos = Array.from(infoMap, ([username, v]) => ({
      username,
      fullName: v.fullName,
      attitude: v.attitude,
    }));
    builder.addChatUsers(infos);

    for (const msg of history) {
      if (msg.role === 'user') {
        builder.addUserPrompt({
          messageId: msg.messageId?.toString(),
          userName: msg.username,
          fullName:
            msg.fullName ??
            ([msg.firstName, msg.lastName].filter(Boolean).join(' ') !== ''
              ? [msg.firstName, msg.lastName].filter(Boolean).join(' ')
              : undefined),
          replyMessage: msg.replyText,
          quoteMessage: msg.quoteText,
          userMessage: msg.content,
        });
      } else {
        builder.addUserPrompt({
          userName: 'Ассистент',
          userMessage: msg.content,
        });
      }
    }

    return builder.build();
  }

  async createSummaryPrompt(
    history: ChatMessage[],
    previousSummary?: string
  ): Promise<string> {
    const builder = this.builderFactory();
    builder.addSummarizationSystem();

    if (previousSummary) {
      builder.addPreviousSummary(previousSummary);
    }

    for (const msg of history) {
      if (msg.role === 'user') {
        builder.addUserPrompt({
          messageId: msg.messageId?.toString(),
          userName: msg.username,
          fullName:
            msg.fullName ??
            ([msg.firstName, msg.lastName].filter(Boolean).join(' ') !== ''
              ? [msg.firstName, msg.lastName].filter(Boolean).join(' ')
              : undefined),
          replyMessage: msg.replyText,
          quoteMessage: msg.quoteText,
          userMessage: msg.content,
        });
      } else {
        builder.addUserPrompt({
          userName: 'Ассистент',
          userMessage: msg.content,
        });
      }
    }

    return builder.build();
  }
}

export const PROMPT_DIRECTOR_ID = Symbol.for(
  'PromptDirector'
) as ServiceIdentifier<PromptDirector>;
