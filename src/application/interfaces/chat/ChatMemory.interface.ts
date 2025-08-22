import type { ChatMessage } from '../ai/AIService.interface';
import type { StoredMessage } from '../messages/StoredMessage.interface';

export interface ChatMemory {
  addMessage(message: StoredMessage): Promise<void>;
  getHistory(): Promise<ChatMessage[]>;
}
