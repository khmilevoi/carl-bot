import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestEnvService } from '../src/services/env/EnvService';
import type { FilePromptService } from '../src/services/prompts/FilePromptService';

class TempEnvService extends TestEnvService {
  constructor(private dir: string) {
    super();
  }

  override getPromptFiles() {
    return {
      persona: join(this.dir, 'persona.md'),
      askSummary: join(this.dir, 'ask_summary_prompt.md'),
      summarizationSystem: join(this.dir, 'summarization_system_prompt.md'),
      previousSummary: join(this.dir, 'previous_summary_prompt.md'),
      userPrompt: join(this.dir, 'user_prompt.md'),
      userPromptSystem: join(this.dir, 'user_prompt_system_prompt.md'),
      priorityRulesSystem: join(this.dir, 'priority_rules_system_prompt.md'),
    };
  }
}

describe('FilePromptService', () => {
  let service: FilePromptService;
  let readFileSpy: ReturnType<typeof vi.fn>;
  let personaPath: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    const dir = mkdtempSync(join(tmpdir(), 'prompts-'));
    personaPath = join(dir, 'persona.md');
    writeFileSync(personaPath, 'persona');
    writeFileSync(join(dir, 'ask_summary_prompt.md'), 'ask {{summary}}');
    writeFileSync(join(dir, 'summarization_system_prompt.md'), '');
    writeFileSync(join(dir, 'previous_summary_prompt.md'), '');
    writeFileSync(
      join(dir, 'user_prompt.md'),
      '{{userMessage}}|{{userName}}|{{fullName}}|{{replyMessage}}|{{quoteMessage}}'
    );
    writeFileSync(join(dir, 'user_prompt_system_prompt.md'), '');
    writeFileSync(join(dir, 'priority_rules_system_prompt.md'), '');

    const actual =
      await vi.importActual<typeof import('fs/promises')>('fs/promises');
    readFileSpy = vi.fn(actual.readFile);
    vi.doMock('fs/promises', () => ({ ...actual, readFile: readFileSpy }));

    const { FilePromptService } = await import(
      '../src/services/prompts/FilePromptService'
    );
    const env = new TempEnvService(dir);
    service = new FilePromptService(env);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPersona reads file only once', async () => {
    expect(await service.getPersona()).toBe('persona');
    expect(await service.getPersona()).toBe('persona');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledWith(personaPath, 'utf-8');
  });

  it('getAskSummaryPrompt substitutes summary', () => {
    expect(service.getAskSummaryPrompt('S')).toBe('ask S');
  });

  it('getUserPrompt substitutes values', () => {
    const prompt = service.getUserPrompt('m', 'u', 'f', 'r', 'q');
    expect(prompt).toBe('m|u|f|r|q');
    const prompt2 = service.getUserPrompt('m');
    expect(prompt2).toBe('m|N/A|N/A|N/A|N/A');
  });
});
