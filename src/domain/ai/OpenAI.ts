import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const OPENAI_REQUEST_PRIORITY = {
  generateMessage: 3,
  summarizeHistory: 2,
  checkInterest: 1,
  assessUsers: 1,
} as const;

interface GenerateMessageRequestBody {
  model: string;
  messages: ChatCompletionMessageParam[];
}

interface SummarizeHistoryRequestBody {
  model: string;
  messages: ChatCompletionMessageParam[];
}

interface CheckInterestRequestBody {
  model: string;
  messages: ChatCompletionMessageParam[];
}

interface AssessUsersRequestBody {
  model: string;
  messages: ChatCompletionMessageParam[];
}

export type OpenAIRequest =
  | { type: 'generateMessage'; body: GenerateMessageRequestBody }
  | { type: 'summarizeHistory'; body: SummarizeHistoryRequestBody }
  | { type: 'checkInterest'; body: CheckInterestRequestBody }
  | { type: 'assessUsers'; body: AssessUsersRequestBody };
// eslint-disable-next-line import/no-unused-modules
export type OpenAIResponse =
  | { type: 'generateMessage'; body: string }
  | { type: 'summarizeHistory'; body: string }
  | {
      type: 'checkInterest';
      body: { messageId: string; why: string } | null;
    }
  | {
      type: 'assessUsers';
      body: { username: string; attitude: string }[];
    };
