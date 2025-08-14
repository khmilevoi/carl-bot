const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const unusedImports = require('eslint-plugin-unused-imports');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  ...tseslint.configs['flat/recommended'],
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
        },
      ],
      'import/no-unused-modules': [
        'error',
        {
          unusedExports: true,
          missingExports: true,
          ignoreExports: [
            'src/index.ts',
            'src/repositories/DbProvider.ts',
            'test/**',
          ],
        },
      ],
    },
    settings: {
      'import/extensions': ['.js', '.ts'],
      'import/resolver': {
        node: {
          extensions: ['.js', '.ts'],
        },
      },
    },
  },
  prettier,
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.cjs'],
  },
];
