import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.firebase/**',
      '.local/**',
      'apps/client/public/decoders/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  {
    files: ['apps/client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'firebase',
            'firebase/*',
            'firebase-*',
            '@firebase/*',
            'react',
            'react/*',
            'react-dom',
            'react-dom/*',
            'three',
            'three/*',
            '@react-three/*',
            '@football/server',
            '@football/client',
            '@football/functions',
          ],
        },
      ],
    },
  },
  prettier,
);
