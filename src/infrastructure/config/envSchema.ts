import { z } from 'zod';

import type { Env } from '@/application/interfaces/env/EnvService';

export const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  OPENAI_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default('debug'),
  ADMIN_CHAT_ID: z.coerce.number(),
  NODE_ENV: z.string().default('development'),
  LOG_PROMPTS: z.coerce.boolean().default(false),
  RABBITMQ_URL: z.string().min(1),
  RABBITMQ_QUEUE: z.string().min(1),
  RABBITMQ_MAX_PRIORITY: z.coerce.number(),
}) as z.ZodType<Env>;
