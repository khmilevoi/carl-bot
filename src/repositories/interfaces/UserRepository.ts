import type { ServiceIdentifier } from 'inversify';

export interface UserEntity {
  id: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  attitude?: string | null;
}

export interface UserRepository {
  upsert(user: UserEntity): Promise<void>;
  findById(id: number): Promise<UserEntity | undefined>;
  setAttitude(userId: number, attitude: string): Promise<void>;
}

export const USER_REPOSITORY_ID = Symbol.for(
  'UserRepository'
) as ServiceIdentifier<UserRepository>;
