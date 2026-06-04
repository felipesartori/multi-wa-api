import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@multi-wa/types': pkg('types'),
      '@multi-wa/config': pkg('config'),
      '@multi-wa/db': pkg('db'),
      '@multi-wa/core': pkg('core'),
      '@multi-wa/engine-baileys': pkg('engine-baileys'),
      '@multi-wa/engine-zapo': pkg('engine-zapo'),
      '@multi-wa/sdk': pkg('sdk')
    }
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/dist/**', 'packages/db/src/migrations/**'],
      thresholds: {
        lines: 20,
        functions: 20,
        statements: 20,
        branches: 40
      }
    }
  }
})
