import { describe, expect, it } from '@jest/globals'
import { parseDocument } from 'yaml'
import { yamlNodeAtPath, yamlPathAt } from './automation-yaml-ast-utils'

describe('automation YAML AST utils', () => {
  it('finds paths and nodes by offset', () => {
    const source = ['steps:', '  - uses: android.tap', '    with:', '      x: 10'].join('\n')
    const document = parseDocument(source, { prettyErrors: false })
    const offset = source.indexOf('10')
    const path = yamlPathAt(document.contents, offset)

    expect(path).toEqual(['steps', 0, 'with', 'x'])
    expect(yamlNodeAtPath(document.contents, ['steps', 0, 'uses'])?.toString()).toBe('android.tap')
  })
})
