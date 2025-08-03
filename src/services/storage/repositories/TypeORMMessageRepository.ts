import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';

import { DATA_SOURCE_ID } from '@/services/storage/dataSource';
import { Message } from '@/services/storage/entities/Message';

import { MessageRepository } from './MessageRepository';

@injectable()
export class TypeORMMessageRepository implements MessageRepository {
  private repo: Promise<Repository<Message>>;

  constructor(@inject(DATA_SOURCE_ID) dataSource: Promise<DataSource>) {
    this.repo = dataSource.then((ds) => ds.getRepository(Message));
  }

  save(message: Message) {
    return this.repo.then((r) => r.save(message));
  }

  findByChatId(chatId: number) {
    return this.repo.then((r) =>
      r.find({ where: { chatId }, order: { id: 'ASC' } })
    );
  }

  async deleteByChatId(chatId: number) {
    await (await this.repo).delete({ chatId });
  }
}
