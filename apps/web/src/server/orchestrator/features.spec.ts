import { notFound } from 'next/navigation'
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

describe('feature availability failures', () => {
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
