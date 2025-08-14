import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import {
  CHAT_USER_REPOSITORY_ID,
  ChatUserRepository,
} from '../../repositories/interfaces/ChatUserRepository';
import {
  USER_REPOSITORY_ID,
  UserRepository,
} from '../../repositories/interfaces/UserRepository';
import { TriggerReason } from '../../triggers/Trigger';
import { AI_SERVICE_ID, AIService } from '../ai/AIService';
import { MessageFactory } from '../messages/MessageFactory';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService';
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
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(CHAT_USER_REPOSITORY_ID)
    private readonly chatUsers: ChatUserRepository,
    @inject(USER_REPOSITORY_ID) private readonly users: UserRepository
  ) {}

  async generate(
    ctx: Context,
    chatId: number,
    triggerReason?: TriggerReason
  ): Promise<string> {
    const memory = this.memories.get(chatId);
    const history = await memory.getHistory();
    const summary = await this.summaries.getSummary(chatId);
    const userIds = await this.chatUsers.listByChat(chatId);
    const attitudes = (
      await Promise.all(
        userIds.map(async (id) => {
          const user = await this.users.findById(id);
          if (!user?.username) {
            return null;
          }
          return { username: user.username, attitude: user.attitude ?? null };
        })
      )
    ).filter(
      (a): a is { username: string; attitude: string | null } => a !== null
    );
    const answer = await this.ai.ask(
      history,
      summary,
      triggerReason,
      attitudes
    );
    await memory.addMessage(MessageFactory.fromAssistant(ctx, answer));
    return answer;
  }
}
