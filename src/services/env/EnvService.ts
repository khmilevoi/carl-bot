import 'dotenv/config';

import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import { ChatModel } from 'openai/resources/shared';
import { z } from 'zod';

const envSchema = z
  .object({
    BOT_TOKEN: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    CHAT_HISTORY_LIMIT: z.coerce.number().int().positive().default(50),
    LOG_LEVEL: z.string().default('debug'),
    ADMIN_CHAT_ID: z.coerce.number(),
    NODE_ENV: z.string().default('development'),
    DOMAIN: z.string().optional(),
    PORT: z.coerce.number().optional(),
    LOG_PROMPTS: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.DOMAIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DOMAIN'],
          message: 'DOMAIN is required in production',
        });
      }
      if (data.PORT === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PORT'],
          message: 'PORT is required in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface EnvService {
  readonly env: Env;
  getAskModel(): ChatModel;
  getSummaryModel(): ChatModel;
}

export const ENV_SERVICE_ID = Symbol.for(
  'EnvService'
) as ServiceIdentifier<EnvService>;

@injectable()
export class DefaultEnvService implements EnvService {
  public readonly env: Env;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  getAskModel(): ChatModel {
    return 'o3';
  }

  getSummaryModel(): ChatModel {
    return 'o3-mini';
  }
}

@injectable()
export class TestEnvService implements EnvService {
  public readonly env: Env = {
    BOT_TOKEN: 'test',
    OPENAI_API_KEY: 'test',
    DATABASE_URL: 'file:///tmp/test.db',
    CHAT_HISTORY_LIMIT: 50,
    LOG_LEVEL: 'silent',
    ADMIN_CHAT_ID: 0,
    NODE_ENV: 'test',
    LOG_PROMPTS: false,
  };

  getAskModel(): ChatModel {
    return 'o3';
  }

  getSummaryModel(): ChatModel {
    return 'o3-mini';
  }
}
