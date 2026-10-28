import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@football/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@football/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**/*.ts', 'packages/shared/src/**/*.ts'],
      exclude: ['**/index.ts', '**/types/**', '**/core/repository.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 98, statements: 98, functions: 100, branches: 90 },
    },
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.tests.json',
      include: ['packages/**/*.test.ts', 'apps/**/tests/**/*.test.ts'],
    },
  },
});
