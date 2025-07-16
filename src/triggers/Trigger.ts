import { DialogueManager } from '../services/DialogueManager';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface MessageContext {
  text: string;
  replyUsername?: string;
  me: string;
}

export interface Trigger {
  apply(
    ctx: MessageContext,
    context: TriggerContext,
    dialogue: DialogueManager
  ): boolean;
}
