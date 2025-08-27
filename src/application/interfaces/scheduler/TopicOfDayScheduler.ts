import type { ServiceIdentifier } from 'inversify';

export interface TopicOfDayScheduler {
  start(): Promise<void>;
}

export const TOPIC_OF_DAY_SCHEDULER_ID = Symbol.for(
  'TopicOfDayScheduler'
) as ServiceIdentifier<TopicOfDayScheduler>;
