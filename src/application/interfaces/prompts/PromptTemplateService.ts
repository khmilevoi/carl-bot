import type { ServiceIdentifier } from 'inversify';

import type { PromptFiles } from '@/application/interfaces/env/EnvService';

export type PromptTemplateName = keyof PromptFiles;

export interface PromptTemplateService {
  loadTemplate(name: PromptTemplateName): Promise<string>;
}

export const PROMPT_TEMPLATE_SERVICE_ID = Symbol.for(
  'PromptTemplateService'
) as ServiceIdentifier<PromptTemplateService>;
