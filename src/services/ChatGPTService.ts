import { readFile } from 'fs/promises';
import { injectable } from 'inversify';
import OpenAI from 'openai';
import { ChatModel } from 'openai/resources/shared';

import { AIService, ChatMessage } from './AIService';
import logger from './logger';

@injectable()
export class ChatGPTService implements AIService {
  private openai: OpenAI;
  private persona: string | null = null;

  constructor(
    apiKey: string,
    private readonly askModel: ChatModel,
    private readonly summaryModel: ChatModel
  ) {
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
      ...history.map((m) => ({
        role: m.role,
        content: `Имя пользователя: ${m.username ?? 'Имя неизвестно'}; Текст сообщения: ${m.content}`,
      }))
    );

    const completion = await this.openai.chat.completions.create({
      model: this.askModel,
      messages,
    });
    logger.debug('Received chat completion response');
    return completion.choices[0]?.message?.content ?? '';
  }

  public async summarize(
    history: ChatMessage[],
    prev?: string
  ): Promise<string> {
    const summaryPrompt = `Создай детальный анализ диалога для дальнейшего использования в качестве системного промпта:

ОБЩИЙ САММАРИ ЧАТА:
- Ключевые темы и вопросы, обсуждаемые в чате
- Общий тон и атмосфера беседы
- Важные решения или выводы, принятые группой

НОВЫЕ ИСТИНЫ (если бот отметил что-то как новую истину):
- Выдели и сохрани все новые истины, которые бот пометил специально
- Запиши их в отдельный раздел для последующего использования

АНАЛИЗ КАЖДОГО ПОЛЬЗОВАТЕЛЯ:
Для каждого участника укажи:
- Имя/ID пользователя
- Взгляды и убеждения: какие позиции занимает, что поддерживает/критикует
- Стиль общения: формальный/неформальный, агрессивный/дружелюбный, краткий/подробный
- Роль в беседе: лидер, участник, наблюдатель, эксперт и т.д.
- Ключевые высказывания и аргументы
- Эмоциональный окрас сообщений

ФОРМАТ:
- Используй маркированные списки для структурирования
- Сохраняй краткость, но не теряй важные детали
- Не добавляй интерпретаций, только факты и наблюдения`;
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
      .map((m) => {
        const name =
          m.role === 'user' ? (m.username ?? 'Пользователь') : 'Ассистент';
        return `${name}: ${m.content}`;
      })
      .join('\n');
    messages.push({
      role: 'user',
      content: `История диалога:\n${historyText}`,
    });
    const completion = await this.openai.chat.completions.create({
      model: this.summaryModel,
      messages,
    });
    logger.debug('Received summary response');
    return completion.choices[0]?.message?.content ?? prev ?? '';
  }
}
