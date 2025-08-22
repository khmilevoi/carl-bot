/* eslint-disable import/no-unused-modules */
import { defineConfig } from '@rsbuild/core';
import path from 'path';

export const rsbuildConfig = defineConfig({
  target: 'node',
  source: {
    entry: {
      index: './src/index.ts',
      migrate: './src/migrate.ts',
    },
  },
  tools: {
    rspack: {
      target: 'node',
      externalsPresets: { node: true },
    },
    swc: {
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
        },
      },
    },
  },
  output: {
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
