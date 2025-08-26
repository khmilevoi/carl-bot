import { inject, injectable } from 'inversify';

import type { PromptBuilder as IPromptBuilder } from '@/application/interfaces/prompts/PromptBuilder';
import type { PromptTemplateService } from '@/application/interfaces/prompts/PromptTemplateService';
import { PROMPT_TEMPLATE_SERVICE_ID } from '@/application/interfaces/prompts/PromptTemplateService';
import type { UserEntity } from '@/domain/entities/UserEntity';

@injectable()
export class PromptBuilder implements IPromptBuilder {
  private persona?: string;
  private users: UserEntity[] = [];
  private restrictions: string[] = [];
  private parts: string[] = [];

  constructor(
    @inject(PROMPT_TEMPLATE_SERVICE_ID)
    private readonly templates: PromptTemplateService
  ) {}

  addPersona(persona: string): this {
    this.persona = persona;
    return this;
  }

  addUsers(users: UserEntity[]): this {
    this.users.push(...users);
    return this;
  }

  addRestrictions(restrictions: string[]): this {
    this.restrictions.push(...restrictions);
    return this;
  }

  addPart(part: string): this {
    this.parts.push(part);
    return this;
  }

  async build(): Promise<string> {
    const sections: string[] = [];

    if (this.persona) {
      const tpl = await this.templates.getPersonaTemplate();
      const replaced = tpl.replace('{{persona}}', this.persona);
      sections.push(replaced);
    }

    if (this.users.length > 0) {
      const tpl = await this.templates.getUsersTemplate();
      const usersText = this.users
        .map((u) => u.username ?? `id:${u.id}`)
        .join(', ');
      const replaced = tpl.replace('{{users}}', usersText);
      sections.push(replaced);
    }

    if (this.restrictions.length > 0) {
      const tpl = await this.templates.getRestrictionsTemplate();
      const restrictionsText = this.restrictions
        .map((r) => `- ${r}`)
        .join('\n');
      const replaced = tpl.replace('{{restrictions}}', restrictionsText);
      sections.push(replaced);
    }

    if (this.parts.length > 0) {
      sections.push(...this.parts);
    }

    return sections.join('\n\n');
  }
}
