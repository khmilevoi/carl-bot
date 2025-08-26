export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
