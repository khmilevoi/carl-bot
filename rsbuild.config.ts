/* eslint-disable import/no-unused-modules */
import { defineConfig } from '@rsbuild/core';
import path from 'path';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
      migrate: './src/migrate.ts',
    },
    decorators: { version: 'legacy' },
  },
  tools: {
    rspack: {
      target: 'node',
      externalsPresets: { node: true },
      externals: {
        sqlite3: 'commonjs sqlite3',
      },
    },
    swc: {
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: false,
        },
      },
    },
  },
  output: {
    target: 'node',
    distPath: {
      root: 'dist',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
