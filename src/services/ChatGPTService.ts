import OpenAI from 'openai';
import { readFile } from 'fs/promises';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatGPTService {
  private openai: OpenAI;
  private persona: string | null = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  private async loadPersona(): Promise<string> {
    if (!this.persona) {
      this.persona = await readFile('persona.md', 'utf-8');
    }
    return this.persona;
  }

  public async ask(history: ChatMessage[], summary?: string): Promise<string> {
    const persona = await this.loadPersona();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: persona },
    ];
    if (summary) {
      messages.push({
        role: 'system',
        content: `Краткая сводка предыдущего диалога: ${summary}`,
      });
    }
    messages.push(...history.map((m) => ({ role: m.role, content: m.content })));
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });
    return completion.choices[0]?.message?.content ?? '';
  }

  public async summarize(history: ChatMessage[], prev?: string): Promise<string> {
    const summaryPrompt =
      'Кратко суммируй ключевые моменты диалога на русском языке.';
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: summaryPrompt },
    ];
    if (prev) {
      messages.push({ role: 'user', content: `Предыдущее резюме: ${prev}` });
    }
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
      .join('\n');
    messages.push({ role: 'user', content: `История диалога:\n${historyText}` });
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
