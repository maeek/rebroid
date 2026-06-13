import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from '@jest/globals'

const projectRoot = join(__dirname, '../../..')
const sourceRoot = join(projectRoot, 'src')

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry)
    if (path.endsWith('theme-token-usage.spec.ts')) {
      return []
    }
    if (statSync(path).isDirectory()) {
      return collectSourceFiles(path)
    }
    return /\.(css|scss|js|ts|tsx)$/.test(path) ? [path] : []
  })

const readSource = () =>
  [...collectSourceFiles(sourceRoot), join(projectRoot, 'tailwind.config.js')]
    .map(file => readFileSync(file, 'utf8'))
    .join('\n')

describe('theme token usage', () => {
  it('does not reintroduce removed theme tokens or utilities', () => {
    const source = readSource()
    const forbiddenPatterns = [
      /\b(?:bg|border|text|ring|outline|from|to|via|fill|stroke)-input(?:\b|\/|-)/,
      /(?:--|var\(--|color-)input\b/,
      /(?:--|var\(--|color-)layout(?:-border)?\b/,
      /(?:--|var\(--|color-)sidebar(?:-[a-z]+)*\b/,
      /control-boundary/
    ]

    for (const pattern of forbiddenPatterns) {
      expect(source).not.toMatch(pattern)
    }
  })
})
