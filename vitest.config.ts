/* eslint-disable import/no-unused-modules */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 86.55, functions: 84.21, branches: 84.52 },
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        '**/index.ts',
        'src/migrate.ts',
        'src/container.ts',
        'src/repositories/**',
        'src/services/env/**',
        'src/services/logging/**',
        '**/*.interface.ts',
      ],
    },
  },
});
