import type { ServiceIdentifier } from 'inversify';

import type { UserEntity } from '@/domain/entities/UserEntity';

export interface PromptBuilder {
  addPersona(persona: string): this;
  addUsers(users: UserEntity[]): this;
  addRestrictions(restrictions: string[]): this;
  addPart(part: string): this;
  build(): Promise<string>;
}

export const PROMPT_BUILDER_ID = Symbol.for(
  'PromptBuilder'
) as ServiceIdentifier<PromptBuilder>;
