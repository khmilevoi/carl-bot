export interface PromptTemplateService {
  loadTemplate(name: string): Promise<string>;
}

import type { ServiceIdentifier } from 'inversify';

export const PROMPT_TEMPLATE_SERVICE_ID = Symbol.for(
  'PromptTemplateService'
) as ServiceIdentifier<PromptTemplateService>;
