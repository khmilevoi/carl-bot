import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';

import { DATA_SOURCE_ID } from '@/services/storage/dataSource';
import { Message } from '@/services/storage/entities/Message';

import { MessageRepository } from './MessageRepository';

@injectable()
export class TypeORMMessageRepository implements MessageRepository {
  private repo: Repository<Message>;

  constructor(@inject(DATA_SOURCE_ID) dataSource: DataSource) {
    this.repo = dataSource.getRepository(Message);
  }

  save(message: Message) {
    return this.repo.save(message);
  }

  findByChatId(chatId: number) {
    return this.repo.find({ where: { chatId }, order: { id: 'ASC' } });
  }

  async deleteByChatId(chatId: number) {
    await this.repo.delete({ chatId });
  }
}
