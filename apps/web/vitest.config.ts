import path from 'node:path'
import { defineConfig } from 'vitest/config'

const src = path.resolve(__dirname, 'src')

export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      'server-only': path.resolve(src, 'test/server-only.ts')
    }
  },
  test: {
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'lcov', 'text'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/test/**'],
      thresholds: {
        statements: 27,
        branches: 25,
        functions: 23,
        lines: 28
      }
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['src/server/**/*.spec.{ts,tsx}'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'client',
          include: ['src/{components,features,hooks,lib,shared}/**/*.spec.{ts,tsx}'],
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'https://localhost:3000/' } },
          setupFiles: ['./src/setup-tests.tsx']
        }
      }
    ]
  }
})
