import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

export const OPENAI_REQUEST_PRIORITY = {
  generateMessage: 3,
  summarizeHistory: 2,
  checkInterest: 1,
  assessUsers: 1,
} as const;

const chatMessageSchema = z.any() as z.ZodType<ChatCompletionMessageParam>;

const generateMessageRequestSchema = z.object({
  type: z.literal('generateMessage'),
  body: z.object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
  }),
});

const summarizeHistoryRequestSchema = z.object({
  type: z.literal('summarizeHistory'),
  body: z.object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
  }),
});

const checkInterestRequestSchema = z.object({
  type: z.literal('checkInterest'),
  body: z.object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
  }),
});

const assessUsersRequestSchema = z.object({
  type: z.literal('assessUsers'),
  body: z.object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
  }),
});

export const openAIRequestSchema = z.discriminatedUnion('type', [
  generateMessageRequestSchema,
  summarizeHistoryRequestSchema,
  checkInterestRequestSchema,
  assessUsersRequestSchema,
]);

export type OpenAIRequest = z.infer<typeof openAIRequestSchema>;

const generateMessageResponseSchema = z.object({
  type: z.literal('generateMessage'),
  body: z.string(),
});

const summarizeHistoryResponseSchema = z.object({
  type: z.literal('summarizeHistory'),
  body: z.string(),
});

const checkInterestResponseSchema = z.object({
  type: z.literal('checkInterest'),
  body: z.object({ messageId: z.string(), why: z.string() }).nullable(),
});

const assessUsersResponseSchema = z.object({
  type: z.literal('assessUsers'),
  body: z.array(z.object({ username: z.string(), attitude: z.string() })),
});

export const openAIResponseSchema = z.discriminatedUnion('type', [
  generateMessageResponseSchema,
  summarizeHistoryResponseSchema,
  checkInterestResponseSchema,
  assessUsersResponseSchema,
]);

export type OpenAIResponse = z.infer<typeof openAIResponseSchema>;
