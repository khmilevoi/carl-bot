import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 90, functions: 90, branches: 80 },
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        '**/index.ts',
        'src/migrate.ts',
        'src/container.ts',
        'src/infrastructure/persistence/**',
        'src/infrastructure/config/**',
        'src/infrastructure/telegram/**',
        'src/triggers/**',
        'src/domain/entities/**',
        '**/*.interface.ts',
      ],
    },
  },
});
