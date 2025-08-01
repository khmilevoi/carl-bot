export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  username?: string;
}

export interface AIService {
  ask(history: ChatMessage[], summary?: string): Promise<string>;
  summarize(history: ChatMessage[], prev?: string): Promise<string>;
}

import type { ServiceIdentifier } from 'inversify';

export const AI_SERVICE_ID = Symbol.for(
  'AIService'
) as ServiceIdentifier<AIService>;
