import type { ServiceIdentifier } from 'inversify';

import type { OpenAIRequest, OpenAIResponse } from '@/domain/ai/OpenAI';

export interface OpenAIClient {
  processRequest(request: OpenAIRequest): Promise<OpenAIResponse>;
}

export const OPENAI_CLIENT_ID = Symbol.for(
  'OpenAIClient'
) as ServiceIdentifier<OpenAIClient>;
