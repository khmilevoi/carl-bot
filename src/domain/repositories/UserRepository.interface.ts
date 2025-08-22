import type { UserEntity } from '@/domain/entities/UserEntity';

export interface UserRepository {
  upsert(user: UserEntity): Promise<void>;
  findById(id: number): Promise<UserEntity | undefined>;
  setAttitude(userId: number, attitude: string): Promise<void>;
}

export const USER_REPOSITORY_ID = Symbol('UserRepository');
