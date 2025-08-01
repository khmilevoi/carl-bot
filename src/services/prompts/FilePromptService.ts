import { readFile } from 'fs/promises';
import { injectable } from 'inversify';

import logger from '../logging/logger';
import { PromptService } from './PromptService';

@injectable()
export class FilePromptService implements PromptService {
  private persona: string | null = null;

  constructor(private personaFile = 'persona.md') {}

  private async loadPersona(): Promise<string> {
    if (!this.persona) {
      logger.debug('Loading persona file');
      this.persona = await readFile(this.personaFile, 'utf-8');
    }
    return this.persona!;
  }

  async getPersona(): Promise<string> {
    return this.loadPersona();
  }

  getAskSummaryPrompt(summary: string): string {
    return `Краткая сводка предыдущего диалога: ${summary}`;
  }

  getSummarizationSystemPrompt(): string {
    return `Создай детальный анализ диалога для дальнейшего использования в качестве системного промпта:\n\nОБЩИЙ САММАРИ ЧАТА:\n- Ключевые темы и вопросы, обсуждаемые в чате\n- Общий тон и атмосфера беседы\n- Важные решения или выводы, принятые группой\n\nНОВЫЕ ИСТИНЫ (если бот отметил что-то как новую истину):\n- Выдели и сохрани все новые истины, которые бот пометил специально\n- Запиши их в отдельный раздел для последующего использования\n\nАНАЛИЗ КАЖДОГО ПОЛЬЗОВАТЕЛЯ:\nДля каждого участника укажи:\n- Имя/ID пользователя\n- Взгляды и убеждения: какие позиции занимает, что поддерживает/критикует\n- Стиль общения: формальный/неформальный, агрессивный/дружелюбный, краткий/подробный\n- Роль в беседе: лидер, участник, наблюдатель, эксперт и т.д.\n- Ключевые высказывания и аргументы\n- Эмоциональный окрас сообщений\n\nФОРМАТ:\n- Используй маркированные списки для структурирования\n- Сохраняй краткость, но не теряй важные детали\n- Не добавляй интерпретаций, только факты и наблюдения`;
  }

  getPreviousSummaryPrompt(prev: string): string {
    return `Вот предыдущее резюме. Сохрани только действительно важные элементы, убери повторы и незначимые детали:\n${prev}`;
  }

  getUserPrompt(text: string, replyText?: string): string {
    let prompt = '';
    if (replyText) {
      prompt += `Пользователь ответил на: ${replyText}; `;
    }
    prompt += `Сообщение пользователя: "${text}";`;
    return prompt;
  }
}
