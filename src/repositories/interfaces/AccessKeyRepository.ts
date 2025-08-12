import type { ServiceIdentifier } from 'inversify';

export interface AccessKeyEntity {
  chatId: number;
  userId: number;
  accessKey: string;
  expiresAt: number;
}

export interface AccessKeyRepository {
  upsert(entry: AccessKeyEntity): Promise<void>;
  find(chatId: number, userId: number): Promise<AccessKeyEntity | undefined>;
  delete(chatId: number, userId: number): Promise<void>;
}

export const ACCESS_KEY_REPOSITORY_ID = Symbol.for(
  'AccessKeyRepository'
) as ServiceIdentifier<AccessKeyRepository>;

export default AccessKeyRepository;
