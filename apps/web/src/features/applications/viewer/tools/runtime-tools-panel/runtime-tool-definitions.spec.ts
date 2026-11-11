import { describe, expect, it } from 'vitest'
import { fullPermissions } from '@/shared/permissions/permissions'
import { getRuntimeTools } from './runtime-tool-definitions'

const isFeatureEnabled = () => true

describe('resource runtime destinations', () => {
  it('exposes permitted tools without duplicating configuration, diagnostics, or viewer settings', () => {
    expect(getRuntimeTools({ isFeatureEnabled, permissions: fullPermissions }).map(tool => tool.id)).toEqual([
      'ai-agent',
      'workflows',
      'files'
    ])
  })
  it('offers workflows independently of AI', () => {
    expect(
      getRuntimeTools({
        permissions: fullPermissions,
        isFeatureEnabled: key => key === 'feature.workflows'
      }).map(tool => tool.id)
    ).toEqual(['workflows', 'files'])
  })
  it('does not offer unauthorized runtime tools', () => {
    expect(getRuntimeTools({ isFeatureEnabled, permissions: {} })).toEqual([])
    expect(
      getRuntimeTools({ isFeatureEnabled, permissions: { 'automations:run': true } }).map(tool => tool.id)
    ).toEqual(['workflows'])
  })
})
