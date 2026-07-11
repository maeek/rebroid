import { describe, expect, it } from 'vitest'
import { workflowFileName } from './automation-editor-utils'

describe('automation editor utils', () => {
  it('creates stable workflow file names', () => {
    expect(workflowFileName(' Daily app check! ')).toBe('daily-app-check')
    expect(workflowFileName('')).toBe('workflow')
    expect(workflowFileName('!!!')).toBe('workflow')
  })
})
