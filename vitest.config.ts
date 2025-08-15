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
        '**/index.ts',
        'src/migrate.ts',
        'src/container.ts',
        'src/repositories/**',
        'src/services/env/**',
        '**/*.interface.ts',
      ],
    },
  },
});
