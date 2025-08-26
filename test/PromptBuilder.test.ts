import { describe, expect, it } from 'vitest';

import type { PromptTemplateService } from '../src/application/interfaces/prompts/PromptTemplateService';
import { PromptBuilder } from '../src/application/services/prompts/PromptBuilder';
import { UserEntity } from '../src/domain/entities/UserEntity';

class StubTemplateService implements PromptTemplateService {
  async getPersonaTemplate(): Promise<string> {
    return 'persona: {{persona}}';
  }
  async getUsersTemplate(): Promise<string> {
    return 'users: {{users}}';
  }
  async getRestrictionsTemplate(): Promise<string> {
    return 'restrictions: {{restrictions}}';
  }
  async getAskSummaryTemplate(): Promise<string> {
    return '';
  }
  async getSummarizationSystemTemplate(): Promise<string> {
    return '';
  }
  async getPreviousSummaryTemplate(): Promise<string> {
    return '';
  }
  async getInterestCheckTemplate(): Promise<string> {
    return '';
  }
  async getUserPromptTemplate(): Promise<string> {
    return '';
  }
  async getUserPromptSystemTemplate(): Promise<string> {
    return '';
  }
  async getPriorityRulesSystemTemplate(): Promise<string> {
    return '';
  }
  async getAssessUsersTemplate(): Promise<string> {
    return '';
  }
  async getReplyTriggerTemplate(): Promise<string> {
    return '';
  }
}

describe('PromptBuilder', () => {
  it('builds full prompt', async () => {
    const builder = new PromptBuilder(new StubTemplateService());
    const users = [new UserEntity(1, 'alice'), new UserEntity(2, 'bob')];
    const prompt = await builder
      .addPersona('test persona')
      .addUsers(users)
      .addRestrictions(['rule1', 'rule2'])
      .addPart('extra')
      .build();

    expect(prompt).toBe(
      'persona: test persona\n\nusers: alice, bob\n\nrestrictions: - rule1\n- rule2\n\nextra'
    );
  });
});
