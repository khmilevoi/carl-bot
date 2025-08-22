import type { ChatMessage } from '../../../domain/messages/ChatMessage.interface';
import type { StoredMessage } from '../../../domain/messages/StoredMessage.interface';

export interface ChatMemory {
  addMessage(message: StoredMessage): Promise<void>;
  getHistory(): Promise<ChatMessage[]>;
}
