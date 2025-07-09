import { readFile } from 'fs/promises';
import OpenAI from 'openai';

import { AIService, ChatMessage } from './AIService';
import logger from './logger';

export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private persona: string | null = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    logger.debug('ChatGPTService initialized');
  }

  private async loadPersona(): Promise<string> {
    if (!this.persona) {
      logger.debug('Loading persona file');
      this.persona = await readFile('persona.md', 'utf-8');
    }

    return this.persona!;
  }

  public async ask(history: ChatMessage[], summary?: string): Promise<string> {
    const persona = await this.loadPersona();
    logger.debug(
      { messages: history.length, summary: !!summary },
      'Sending chat completion request'
    );
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
    logger.debug('Received chat completion response');
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
    logger.debug(
      { history: history.length, prevLength: prev?.length ?? 0 },
      'Sending summarization request'
    );
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
    logger.debug('Received summary response');
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
