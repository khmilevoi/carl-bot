import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';

import type { EnvService } from '@/application/interfaces/env/EnvService';
import { ENV_SERVICE_ID } from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { PromptTemplateService } from '@/application/interfaces/prompts/PromptTemplateService';

@injectable()
export class FilePromptTemplateService implements PromptTemplateService {
  private readonly files: Record<string, string>;
  private readonly cache = new Map<string, Promise<string>>();
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.files = envService.getPromptFiles();
    this.logger = loggerFactory.create('FilePromptTemplateService');
  }

  async loadTemplate(name: string): Promise<string> {
    let template = this.cache.get(name);
    if (!template) {
      const path = this.files[name as keyof typeof this.files];
      if (!path) {
        throw new Error(`Unknown prompt template: ${name}`);
      }
      template = readFile(path, 'utf-8').then((content) => {
        this.logger.debug(
          `Loaded ${name} template from ${path} (${Buffer.byteLength(content)} bytes)`
        );
        return content;
      });
      this.cache.set(name, template);
    }
    return template;
  }
}
