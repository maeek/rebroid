import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(__dirname, '../..')

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return collectSourceFiles(path)
    return /\.(?:ts|tsx)$/.test(path) ? [path] : []
  })

const sourceFile = (fileName: string, source: string) =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)

const hasDirective = (file: ts.SourceFile, directive: 'use client' | 'use server') => {
  const firstStatement = file.statements[0]
  return (
    Boolean(firstStatement) &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === directive
  )
}

const resolveServerModule = (specifier: string) => {
  const path = join(sourceRoot, specifier.slice(2))
  return [`${path}.ts`, `${path}.tsx`, join(path, 'index.ts'), join(path, 'index.tsx')].find(candidate => {
    try {
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

const clientServerImportViolations = (file: ts.SourceFile, isServerActionModule: (specifier: string) => boolean) => {
  if (!hasDirective(file, 'use client')) return []

  return file.statements.flatMap(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return []
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('@/server/')) return []

    const clause = statement.importClause
    const hasTypeImport =
      Boolean(clause?.isTypeOnly) ||
      Boolean(
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.some(element => element.isTypeOnly)
      )
    if (hasTypeImport) return [`${specifier} imports a server-owned type`]
    if (!isServerActionModule(specifier)) return [`${specifier} is not a Server Action module`]
    return []
  })
}

describe('web source boundaries', () => {
  it('allows client runtime imports only from Server Action modules', () => {
    const violations = collectSourceFiles(sourceRoot).flatMap(fileName => {
      const file = sourceFile(fileName, readFileSync(fileName, 'utf8'))
      return clientServerImportViolations(file, specifier => {
        const resolved = resolveServerModule(specifier)
        return Boolean(resolved && hasDirective(sourceFile(resolved, readFileSync(resolved, 'utf8')), 'use server'))
      }).map(violation => `${fileName}: ${violation}`)
    })

    expect(violations).toEqual([])
  }, 15_000)

  it('recognizes allowed actions and rejected server-model fixtures', () => {
    const allowed = sourceFile('allowed.tsx', "'use client'\nimport { saveAction } from '@/server/save-action'")
    const rejectedType = sourceFile('type.tsx', "'use client'\nimport type { Secret } from '@/server/model'")
    const rejectedRuntime = sourceFile('runtime.tsx', "'use client'\nimport { readSecret } from '@/server/model'")

    expect(clientServerImportViolations(allowed, specifier => specifier.endsWith('-action'))).toEqual([])
    expect(clientServerImportViolations(rejectedType, () => true)).toEqual([
      '@/server/model imports a server-owned type'
    ])
    expect(clientServerImportViolations(rejectedRuntime, () => false)).toEqual([
      '@/server/model is not a Server Action module'
    ])
  })

  it('keeps re-export-only modules limited to route entries', () => {
    const violations = collectSourceFiles(sourceRoot).filter(fileName => {
      if (fileName === join(sourceRoot, 'test/server-only.ts')) return false
      if (fileName.includes(`${join(sourceRoot, 'app')}/`) && /\/(?:page|loading)\.tsx$/.test(fileName)) return false

      const statements = sourceFile(fileName, readFileSync(fileName, 'utf8')).statements
      return statements.length > 0 && statements.every(ts.isExportDeclaration)
    })

    expect(violations).toEqual([])
  })
})
