import { readFile } from 'fs/promises';
import OpenAI from 'openai';

import { AIService, ChatMessage } from './AIService';

export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private persona: string | null = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  private async loadPersona(): Promise<string> {
    if (!this.persona) {
      this.persona = await readFile('persona.md', 'utf-8');
    }

    return this.persona!;
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

    messages.push(
      ...history.map((m) => ({ role: m.role, content: m.content }))
    );

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });
    return completion.choices[0]?.message?.content ?? '';
  }

  public async summarize(
    history: ChatMessage[],
    prev?: string
  ): Promise<string> {
    const summaryPrompt = `Просуммируй ключевые моменты диалога для дальнейшего использования в качестве системного промпта.\n- Не оценивай и не интерпретируй сообщения, только выделяй факты, вопросы, ответы и решения.\n- Не повторяй одни и те же мысли.\n- Сохраняй краткость, избегай лишних деталей.\n- Используй маркированный список или короткие абзацы.\n- Не добавляй ничего от себя.`;
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: summaryPrompt },
    ];
    if (prev) {
      messages.push({
        role: 'user',
        content: `Вот предыдущее резюме. Сохрани только действительно важные элементы, убери повторы и незначимые детали:\n${prev}`,
      });
    }
    const historyText = history
      .map(
        (m) =>
          `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`
      )
      .join('\n');
    messages.push({
      role: 'user',
      content: `История диалога:\n${historyText}`,
    });
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
