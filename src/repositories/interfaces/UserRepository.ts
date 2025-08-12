import type { ServiceIdentifier } from 'inversify';

export interface UserEntity {
  id: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface UserRepository {
  upsert(user: UserEntity): Promise<void>;
  findById(id: number): Promise<UserEntity | undefined>;
}

export const USER_REPOSITORY_ID = Symbol.for(
  'UserRepository'
) as ServiceIdentifier<UserRepository>;

export default UserRepository;
