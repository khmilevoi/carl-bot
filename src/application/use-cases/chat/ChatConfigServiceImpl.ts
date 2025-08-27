import { inject, injectable, LazyServiceIdentifier } from 'inversify';

import { type ChatConfigService } from '@/application/interfaces/chat/ChatConfigService';
import {
  TOPIC_OF_DAY_SCHEDULER_ID,
  type TopicOfDayScheduler,
} from '@/application/interfaces/scheduler/TopicOfDayScheduler';
import {
  CHAT_CONFIG_REPOSITORY_ID,
  type ChatConfigRepository,
} from '@/domain/repositories/ChatConfigRepository';

import { RepositoryChatConfigService } from './RepositoryChatConfigService';

@injectable()
export class ChatConfigServiceImpl
  extends RepositoryChatConfigService
  implements ChatConfigService
{
  constructor(
    @inject(CHAT_CONFIG_REPOSITORY_ID) repo: ChatConfigRepository,
    @inject(new LazyServiceIdentifier(() => TOPIC_OF_DAY_SCHEDULER_ID))
    private readonly scheduler: TopicOfDayScheduler
  ) {
    super(repo);
  }

  override async setTopicTime(
    chatId: number,
    topicTime: string | null,
    topicTimezone: string
  ): Promise<void> {
    await super.setTopicTime(chatId, topicTime, topicTimezone);
    await this.scheduler.reschedule(chatId);
  }
}
