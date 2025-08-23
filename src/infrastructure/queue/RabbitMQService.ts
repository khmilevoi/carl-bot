/* istanbul ignore file */
import amqp, { type Channel, type ConsumeMessage } from 'amqplib';
import { randomUUID } from 'crypto';
import { inject, injectable } from 'inversify';
import type { ZodSchema } from 'zod';

import {
  ENV_SERVICE_ID,
  type EnvService,
} from '@/application/interfaces/env/EnvService';
import type { RabbitMQService } from '@/application/interfaces/queue/RabbitMQService';

@injectable()
export class AmqplibRabbitMQService implements RabbitMQService {
  private channel?: Channel;

  constructor(
    @inject(ENV_SERVICE_ID) private readonly envService: EnvService
  ) {}

  async publish<T>(message: T, priority: number): Promise<void> {
    const channel = await this.getChannel();
    channel.sendToQueue(
      this.envService.env.RABBITMQ_QUEUE,
      Buffer.from(JSON.stringify(message)),
      { priority }
    );
  }

  async consume<T>(
    schema: ZodSchema<T>,
    onMessage: (message: T, priority: number) => Promise<void>
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.consume(
      this.envService.env.RABBITMQ_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        const data = schema.parse(JSON.parse(msg.content.toString()));
        await onMessage(data, msg.properties.priority ?? 0);
        channel.ack(msg);
      }
    );
  }

  async rpc<TRequest, TResponse>(
    message: TRequest,
    priority: number,
    schema: ZodSchema<TResponse>
  ): Promise<TResponse> {
    const channel = await this.getChannel();
    const { queue } = await channel.assertQueue('', { exclusive: true });
    const correlationId = randomUUID();
    return new Promise<TResponse>((resolve) => {
      channel.consume(
        queue,
        (msg: ConsumeMessage | null) => {
          if (msg && msg.properties.correlationId === correlationId) {
            const parsed = schema.parse(JSON.parse(msg.content.toString()));
            resolve(parsed);
          }
        },
        { noAck: true }
      );
      channel.sendToQueue(
        this.envService.env.RABBITMQ_QUEUE,
        Buffer.from(JSON.stringify(message)),
        { priority, correlationId, replyTo: queue }
      );
    });
  }

  async consumeRpc<TRequest, TResponse>(
    schema: ZodSchema<TRequest>,
    onMessage: (message: TRequest, priority: number) => Promise<TResponse>
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.consume(
      this.envService.env.RABBITMQ_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        const request = schema.parse(JSON.parse(msg.content.toString()));
        const response = await onMessage(request, msg.properties.priority ?? 0);
        channel.sendToQueue(
          msg.properties.replyTo ?? '',
          Buffer.from(JSON.stringify(response)),
          { correlationId: msg.properties.correlationId }
        );
        channel.ack(msg);
      }
    );
  }

  private async getChannel(): Promise<Channel> {
    if (!this.channel) {
      const connection = await amqp.connect(this.envService.env.RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertQueue(this.envService.env.RABBITMQ_QUEUE, {
        durable: true,
        maxPriority: this.envService.env.RABBITMQ_MAX_PRIORITY,
      });
      this.channel = channel;
    }
    return this.channel as Channel;
  }
}
