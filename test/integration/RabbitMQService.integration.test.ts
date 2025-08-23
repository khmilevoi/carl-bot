import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('amqplib', () => {
  const amqp = require('amqplib-mocks');
  return { ...amqp, default: amqp };
});

import { AmqplibRabbitMQService } from '../../src/infrastructure/queue/RabbitMQService';
import { TestEnvService } from '../../src/infrastructure/config/TestEnvService';

describe('RabbitMQService integration', () => {
  it('publishes and consumes messages with priority', async () => {
    const service = new AmqplibRabbitMQService(new TestEnvService());
    const schema = z.object({ value: z.string() });
    let resolveFn: (v: { msg: { value: string }; priority: number }) => void;
    const consumed = new Promise<{ msg: { value: string }; priority: number }>(
      (resolve) => {
        resolveFn = resolve;
      }
    );
    await service.consume(schema, async (msg, priority) => {
      resolveFn({ msg, priority });
    });
    await service.publish({ value: 'test' }, 5);
    const result = await consumed;
    expect(result).toEqual({ msg: { value: 'test' }, priority: 5 });
  });
});
