import type { ServiceIdentifier } from 'inversify';

export interface RabbitMQService {
  publish(message: string, priority: number): Promise<void>;
  consume(
    onMessage: (message: string, priority: number) => Promise<void>
  ): Promise<void>;
  rpc(message: string, priority: number): Promise<string>;
  consumeRpc(
    onMessage: (message: string, priority: number) => Promise<string>
  ): Promise<void>;
}

export const RABBITMQ_SERVICE_ID = Symbol.for(
  'RabbitMQService'
) as ServiceIdentifier<RabbitMQService>;
