import type { ServiceIdentifier } from 'inversify';

export interface DialogueManager {
  start(chatId: number): void;
  extend(chatId: number): void;
  isActive(chatId: number): boolean;
}

export const DIALOGUE_MANAGER_ID = Symbol.for(
  'DialogueManager'
) as ServiceIdentifier<DialogueManager>;
