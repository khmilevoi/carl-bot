import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { TriggerReason } from '@/domain/triggers/Trigger';

export interface AIService {
  ask(
    history: ChatMessage[],
    summary?: string,
    triggerReason?: TriggerReason
  ): Promise<string>;
  summarize(history: ChatMessage[], prev?: string): Promise<string>;
  checkInterest(
    history: ChatMessage[],
    summary: string
  ): Promise<{ messageId: string; why: string } | null>;
  assessUsers(
    messages: ChatMessage[],
    prevAttitudes?: { username: string; attitude: string }[]
  ): Promise<{ username: string; attitude: string }[]>;
  generateTopicOfDay(): Promise<string>;
}

import type { ServiceIdentifier } from 'inversify';

export const AI_SERVICE_ID = Symbol.for(
  'AIService'
) as ServiceIdentifier<AIService>;
