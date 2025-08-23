import type { ServiceIdentifier } from 'inversify';
import type { ZodSchema } from 'zod';

export interface RabbitMQService {
  publish<T>(message: T, priority: number): Promise<void>;
  consume<T>(
    schema: ZodSchema<T>,
    onMessage: (message: T, priority: number) => Promise<void>
  ): Promise<void>;
  rpc<TRequest, TResponse>(
    message: TRequest,
    priority: number,
    schema: ZodSchema<TResponse>
  ): Promise<TResponse>;
  consumeRpc<TRequest, TResponse>(
    schema: ZodSchema<TRequest>,
    onMessage: (message: TRequest, priority: number) => Promise<TResponse>
  ): Promise<void>;
}

export const RABBITMQ_SERVICE_ID = Symbol.for(
  'RabbitMQService'
) as ServiceIdentifier<RabbitMQService>;
