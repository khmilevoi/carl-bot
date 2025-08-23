import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => {
  let consumeCallback: ((msg: any) => Promise<void> | void) | undefined;
  const sendToQueue = vi.fn();
  const ack = vi.fn();
  const consume = vi.fn(async (_queue: string, cb: any) => {
    consumeCallback = cb;
  });
  const assertQueue = vi.fn();
  const channel = { sendToQueue, ack, consume, assertQueue } as any;
  const createChannel = vi.fn(async () => channel);
  const connect = vi.fn(async () => ({ createChannel }));
  return {
    sendToQueue,
    ack,
    consume,
    assertQueue,
    connect,
    getConsumeCallback: () => consumeCallback,
  };
});

vi.mock('amqplib', () => ({
  default: { connect: mocks.connect },
  connect: mocks.connect,
}));

import { AmqplibRabbitMQService } from '../src/infrastructure/queue/RabbitMQService';
import { TestEnvService } from '../src/infrastructure/config/TestEnvService';

describe('AmqplibRabbitMQService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes message with specified priority', async () => {
    const service = new AmqplibRabbitMQService(new TestEnvService());
    await service.publish({ foo: 'bar' }, 4);
    expect(mocks.sendToQueue).toHaveBeenCalledWith(
      'test-queue',
      Buffer.from(JSON.stringify({ foo: 'bar' })),
      { priority: 4 }
    );
  });

  it('passes priority to consumer and acknowledges', async () => {
    const service = new AmqplibRabbitMQService(new TestEnvService());
    const schema = z.object({ foo: z.string() });
    const onMessage = vi.fn();
    await service.consume(schema, async (msg, priority) => {
      onMessage(msg, priority);
    });
    await mocks.getConsumeCallback()?.({
      content: Buffer.from(JSON.stringify({ foo: 'bar' })),
      properties: { priority: 9 },
    });
    expect(onMessage).toHaveBeenCalledWith({ foo: 'bar' }, 9);
    expect(mocks.ack).toHaveBeenCalled();
  });
});
