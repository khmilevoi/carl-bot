import { describe, expect, it } from 'vitest';

import {
  DefaultMessageContextExtractor,
  MessageContextExtractor,
} from '../src/services/messages/MessageContextExtractor';

describe('MessageContextExtractor', () => {
  const extractor: MessageContextExtractor =
    new DefaultMessageContextExtractor();

  it('extracts username, fullName, reply and quote text', () => {
    const ctx: any = {
      from: { username: 'user', first_name: 'John', last_name: 'Smith' },
      message: {
        text: 'hi',
        reply_to_message: {
          text: 'hello',
          from: { first_name: 'Jane', last_name: 'Doe' },
        },
        quote: { text: 'quoted' },
      },
    };

    const res = extractor.extract(ctx);
    expect(res.username).toBe('user');
    expect(res.fullName).toBe('John Smith');
    expect(res.replyText).toBe('hello');
    expect(res.replyUsername).toBe('Jane Doe');
    expect(res.quoteText).toBe('quoted');
  });
});
