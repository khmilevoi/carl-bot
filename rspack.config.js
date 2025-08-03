/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: {
    index: './src/index.ts',
    migrate: './src/migrate.ts',
  },
  target: 'node',
  mode: process.env.NODE_ENV,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
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
        test: /\.ts$/,
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
  externals: {
    dotenv: 'commonjs dotenv',
    inversify: 'commonjs inversify',
    natural: 'commonjs natural',
    openai: 'commonjs openai',
    pino: 'commonjs pino',
    'pino-pretty': 'commonjs pino-pretty',
    'reflect-metadata': 'commonjs reflect-metadata',
    sqlite: 'commonjs sqlite',
    sqlite3: 'commonjs sqlite3',
    telegraf: 'commonjs telegraf',
  },
};
