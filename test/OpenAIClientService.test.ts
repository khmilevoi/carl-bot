import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createMock } },
  })),
}));

import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';
import { TestEnvService } from '../src/infrastructure/config/TestEnvService';
import { OpenAIClientService } from '../src/infrastructure/external/OpenAIClient';

describe('OpenAIClientService', () => {
  let service: OpenAIClientService;

  beforeEach(() => {
    createMock.mockReset();
    const env = new TestEnvService();
    const loggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory;
    service = new OpenAIClientService(env, loggerFactory);
  });

  it('handles generateMessage', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'hi' } }] });
    const res = await service.processRequest({
      type: 'generateMessage',
      body: { model: 'm', messages: [] },
    });
    expect(res).toEqual({ type: 'generateMessage', body: 'hi' });
  });

  it('handles summarizeHistory', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'sum' } }],
    });
    const res = await service.processRequest({
      type: 'summarizeHistory',
      body: { model: 'm', messages: [] },
    });
    expect(res).toEqual({ type: 'summarizeHistory', body: 'sum' });
  });

  it('handles checkInterest', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"messageId":"1","why":"x"}' } }],
    });
    const res = await service.processRequest({
      type: 'checkInterest',
      body: { model: 'm', messages: [] },
    });
    expect(res).toEqual({
      type: 'checkInterest',
      body: { messageId: '1', why: 'x' },
    });
  });

  it('handles assessUsers', async () => {
    createMock.mockResolvedValue({
      choices: [
        { message: { content: '[{"username":"u","attitude":"good"}]' } },
      ],
    });
    const res = await service.processRequest({
      type: 'assessUsers',
      body: { model: 'm', messages: [] },
    });
    expect(res).toEqual({
      type: 'assessUsers',
      body: [{ username: 'u', attitude: 'good' }],
    });
  });
});
