import { describe, expect, it } from 'vitest';

import { PromptDirector } from '../src/application/prompts/PromptDirector';
import type {
  PromptBuilder,
  PromptBuilderFactory,
} from '../src/application/prompts/PromptBuilder';
import type { ChatMessage } from '../src/domain/messages/ChatMessage';
import type { TriggerReason } from '../src/domain/triggers/Trigger';

class FakeBuilder {
  private steps: string[] = [];
  addPersona(): this {
    this.steps.push('persona');
    return this;
  }
  addPriorityRulesSystem(): this {
    this.steps.push('rules');
    return this;
  }
  addUserPromptSystem(): this {
    this.steps.push('userPromptSystem');
    return this;
  }
  addCheckInterest(): this {
    this.steps.push('checkInterest');
    return this;
  }
  addAskSummary(summary?: string): this {
    if (summary) {
      this.steps.push(`askSummary:${summary}`);
    }
    return this;
  }
  addReplyTrigger(reason?: string, message?: string): this {
    if (reason && message) {
      this.steps.push(`trigger:${reason}:${message}`);
    }
    return this;
  }
  addChatUsers(
    users: { username: string; fullName: string; attitude: string }[]
  ): this {
    this.steps.push(`chatUsers:${users.map((u) => u.username).join(',')}`);
    return this;
  }
  addUserPrompt(params: { userMessage: string }): this {
    this.steps.push(`user:${params.userMessage}`);
    return this;
  }
  addMessages(messages: ChatMessage[]): this {
    for (const m of messages) {
      this.addUserPrompt({ userMessage: m.content });
    }
    return this;
  }
  addSummarizationSystem(): this {
    this.steps.push('summarySystem');
    return this;
  }
  addPreviousSummary(summary?: string): this {
    if (summary) {
      this.steps.push(`prev:${summary}`);
    }
    return this;
  }
  addAssessUsers(): this {
    this.steps.push('assessUsers');
    return this;
  }
  build(): Promise<string> {
    return Promise.resolve(this.steps.join('|'));
  }
}

describe('PromptDirector', () => {
  const factory: PromptBuilderFactory = () =>
    new FakeBuilder() as unknown as PromptBuilder;

  it('creates answer prompt', async () => {
    const director = new PromptDirector(factory);
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'hi',
        username: 'u1',
        attitude: 'a1',
        messageId: 1,
      },
      { role: 'assistant', content: 'hello' },
    ];
    const trigger: TriggerReason = { why: 'w', message: 'm' };
    const result = await director.createAnswerPrompt(history, 'sum', trigger);
    expect(result).toBe(
      'persona|rules|userPromptSystem|askSummary:sum|trigger:w:m|chatUsers:u1|user:hi|user:hello'
    );
  });

  it('creates summary prompt', async () => {
    const director = new PromptDirector(factory);
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'hi',
        username: 'u1',
        attitude: 'a1',
        messageId: 1,
      },
      { role: 'assistant', content: 'hello' },
    ];
    const result = await director.createSummaryPrompt(history, 'prev');
    expect(result).toBe('summarySystem|prev:prev|user:hi|user:hello');
  });

  it('creates interest prompt', async () => {
    const director = new PromptDirector(factory);
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'hi',
        username: 'u1',
        attitude: 'a1',
        messageId: 1,
      },
      { role: 'assistant', content: 'hello' },
    ];
    const result = await director.createInterestPrompt(history);
    expect(result).toBe('persona|checkInterest|user:hi|user:hello');
  });

  it('creates assess users prompt', async () => {
    const director = new PromptDirector(factory);
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'hi',
        username: 'u1',
        attitude: 'a1',
        messageId: 1,
        fullName: 'F1',
      },
      { role: 'assistant', content: 'hello' },
    ];
    const prev = [{ username: 'u1', attitude: 'old' }];
    const result = await director.createAssessUsersPrompt(history, prev);
    expect(result).toBe('persona|assessUsers|chatUsers:u1|user:hi|user:hello');
  });
});
