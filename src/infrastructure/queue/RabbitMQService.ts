import amqp, { type Channel, type ConsumeMessage } from 'amqplib';
import { inject, injectable } from 'inversify';

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

  async publish(message: string, priority: number): Promise<void> {
    const channel = await this.getChannel();
    channel.sendToQueue(
      this.envService.env.RABBITMQ_QUEUE,
      Buffer.from(message),
      { priority }
    );
  }

  async consume(
    onMessage: (message: string, priority: number) => Promise<void>
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.consume(
      this.envService.env.RABBITMQ_QUEUE,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        await onMessage(msg.content.toString(), msg.properties.priority ?? 0);
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
