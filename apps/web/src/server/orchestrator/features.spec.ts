import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { requireFeature } from './features'
import { OrchestratorRequestError } from './request'
import { orchestratorSettingsClient } from './settings/client'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not-found')
  })
}))
vi.mock('./settings/client', () => ({ orchestratorSettingsClient: { getFeatures: vi.fn() } }))
vi.mock('next/server', () => ({ connection: vi.fn() }))

describe('feature availability failures', () => {
  it('waits for a request before making a guarded feature read', async () => {
    const request = Promise.withResolvers<void>()
    vi.mocked(connection).mockReturnValueOnce(request.promise)
    const error = new OrchestratorRequestError('offline', 502)
    vi.mocked(orchestratorSettingsClient.getFeatures).mockRejectedValueOnce(error)
    const result = requireFeature('feature.workflows')
    const failure = expect(result).rejects.toBe(error)
    try {
      expect(orchestratorSettingsClient.getFeatures).not.toHaveBeenCalled()
    } finally {
      request.resolve()
      await failure
    }
  })

  it('preserves outages instead of misreporting a disabled feature', async () => {
    const error = new OrchestratorRequestError('offline', 502)
    vi.mocked(orchestratorSettingsClient.getFeatures).mockRejectedValueOnce(error)
    await expect(requireFeature('feature.image-builder')).rejects.toBe(error)
    expect(notFound).not.toHaveBeenCalled()
  })
  it('still denies a feature that is absent from a successfully loaded registry', async () => {
    vi.mocked(orchestratorSettingsClient.getFeatures).mockResolvedValueOnce({ revision: 1, features: [] })
    await expect(requireFeature('feature.firewall')).rejects.toThrow('not-found')
  })
})
