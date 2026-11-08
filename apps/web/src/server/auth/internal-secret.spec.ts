import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasInternalSecret } from './internal-secret'
describe('internal request authentication', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('fails closed for missing configuration or wrong secrets', () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', '')
    expect(hasInternalSecret(new Headers())).toBe(false)
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'configured-secret')
    expect(hasInternalSecret(new Headers())).toBe(false)
    expect(hasInternalSecret(new Headers({ 'x-orchestrator-secret': 'wrong' }))).toBe(false)
    expect(hasInternalSecret(new Headers({ 'x-orchestrator-secret': 'configured-secret' }))).toBe(true)
  })
})
