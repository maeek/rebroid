import { describe, expect, it } from 'vitest'
import { fullPermissions } from '@/shared/permissions/permissions'
import { getRuntimeTools } from './runtime-tool-definitions'

describe('resource runtime destinations', () => {
  it('exposes permitted tools without duplicating configuration, diagnostics, or viewer settings', () => {
    expect(getRuntimeTools({ permissions: fullPermissions }).map(tool => tool.id)).toEqual([
      'ai-agent',
      'workflows',
      'clipboard',
      'files'
    ])
  })
  it('does not offer unauthorized runtime tools', () => {
    expect(getRuntimeTools({ permissions: {} })).toEqual([])
    expect(getRuntimeTools({ permissions: { 'automations:run': true } }).map(tool => tool.id)).toEqual(['workflows'])
  })
})
