export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  username?: string;
  fullName?: string;
  replyText?: string;
  replyUsername?: string;
  quoteText?: string;
  userId?: number;
  messageId?: number;
  chatId?: number;
  attitude?: string | null;
}

import { TriggerReason } from '../../triggers/Trigger.interface';

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
}

import type { ServiceIdentifier } from 'inversify';

export const AI_SERVICE_ID = Symbol.for(
  'AIService'
) as ServiceIdentifier<AIService>;
