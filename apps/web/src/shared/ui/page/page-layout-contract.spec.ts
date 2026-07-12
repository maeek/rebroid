import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(__dirname, '../../..')

const collectTsxFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry)
    if (path.endsWith('.spec.tsx')) return []
    if (statSync(path).isDirectory()) return collectTsxFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })

describe('page layout contract', () => {
  const sourceFiles = collectTsxFiles(sourceRoot)

  it('keeps responsive columns inside PageContent instead of changing its flex direction', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      const pageContentTags = source.match(/<PageContent\b[\s\S]*?>/g) ?? []

      for (const tag of pageContentTags) {
        expect(tag, file).not.toMatch(/\b(?:sm|md|lg|xl|2xl):flex(?=\s|['"])/)
        expect(tag, file).not.toMatch(/\b(?:px-6|pb-16|max-sm:px-4)\b/)
      }
    }
  })

  it('uses explicit grid tracks instead of ambiguous fractional flex page columns', () => {
    for (const file of sourceFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bflex-(?:2|3)\/5\b/)
    }
  })

  it('makes select trigger width explicit at every feature call site', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      const selectTriggerTags = source.match(/<SelectTrigger\b[\s\S]*?>/g) ?? []

      for (const tag of selectTriggerTags) {
        expect(tag, file).toContain('className=')
      }
    }
  })

  it('makes every form field layout explicit', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      const formFieldTags = source.match(/<FormField\b[\s\S]*?>/g) ?? []

      for (const tag of formFieldTags) {
        expect(tag, file).toContain('layout=')
      }
    }
  })
})
