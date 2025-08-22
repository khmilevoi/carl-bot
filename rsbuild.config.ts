/* eslint-disable import/no-unused-modules */
import { defineConfig } from '@rsbuild/core';
import { pluginNode } from '@rsbuild/plugin-node';
import path from 'path';

export const rsbuildConfig = defineConfig({
  plugins: [pluginNode()],
  target: 'node',
  source: {
    entry: {
      index: './src/index.ts',
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
