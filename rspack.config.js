/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('node:path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  target: 'node',
  mode: 'production',
  entry: {
    index: './src/index.ts',
    migrate: './src/migrate.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // transpile TypeScript files
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2016',
          },
          module: {
            type: 'commonjs',
          },
        },
      },
    ],
  },
  externalsPresets: { node: true },
  externalsType: 'commonjs',
  externals: [
    ({ request }, callback) => {
      if (/^[a-z@][a-z0-9/._-]*$/i.test(request)) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    },
  ],
};
