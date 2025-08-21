import type { ServiceIdentifier } from 'inversify';

import type { AccessKeyEntity } from '../entities/AccessKeyEntity';

export interface AccessKeyRepository {
  upsertKey(entry: AccessKeyEntity): Promise<void>;
  findByChatAndUser(
    chatId: number,
    userId: number
  ): Promise<AccessKeyEntity | undefined>;
  deleteExpired(now: number): Promise<void>;
}

export const ACCESS_KEY_REPOSITORY_ID = Symbol.for(
  'AccessKeyRepository'
) as ServiceIdentifier<AccessKeyRepository>;
