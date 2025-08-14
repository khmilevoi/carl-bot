/* eslint-disable import/no-unused-modules */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 90, functions: 90, branches: 90 },
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        'src/index.ts',
        'src/migrate.ts',
        'src/bot/**',
        'src/services/ai/**',
        'src/services/admin/AdminServiceImpl.ts',
        'src/repositories/**',
        'src/services/env/**',
        'src/services/chat/ChatMemory.ts',
        'src/services/messages/**',
        'src/services/messages/StoredMessage.ts',
        'src/triggers/Trigger.ts',
      ],
    },
  },
});
