import { describe, expect, it, vi } from 'vitest'
import { OrchestratorPageBoundary } from './orchestrator-page-boundary'
import { getOrchestratorPageHealth } from './orchestrator-page-read'
import { OrchestratorRequestError } from './request'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

vi.mock('./orchestrator-page-read', async importOriginal => ({
  ...(await importOriginal<typeof import('./orchestrator-page-read')>()),
  getOrchestratorPageHealth: vi.fn()
}))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))

const health = (online: boolean) => ({ services: { orchestrator: { ok: online } } }) as OrchestratorHealth

describe('runtime page outage boundary', () => {
  it('does not load dependent data or mount content when the orchestrator is offline', async () => {
    vi.mocked(getOrchestratorPageHealth).mockResolvedValueOnce(health(false))
    const load = vi.fn()
    const children = vi.fn()
    expect(await OrchestratorPageBoundary({ load, children, fallback: 'One outage screen' })).toBe('One outage screen')
    expect(load).not.toHaveBeenCalled()
    expect(children).not.toHaveBeenCalled()
  })

  it('renders a single fallback when the health request fails', async () => {
    vi.mocked(getOrchestratorPageHealth).mockRejectedValueOnce(new OrchestratorRequestError('private host', 502))
    const load = vi.fn()
    expect(await OrchestratorPageBoundary({ load, children: () => 'ready', fallback: 'unavailable' })).toBe(
      'unavailable'
    )
    expect(load).not.toHaveBeenCalled()
  })

  it('handles dependency failures after a successful health check and reloads on recovery', async () => {
    vi.mocked(getOrchestratorPageHealth).mockResolvedValue(health(true))
    const load = vi
      .fn()
      .mockRejectedValueOnce(new OrchestratorRequestError('private endpoint', 503))
      .mockResolvedValueOnce('saved data')
    const props = { load, children: (data: string) => data, fallback: 'unavailable' }
    expect(await OrchestratorPageBoundary(props)).toBe('unavailable')
    expect(await OrchestratorPageBoundary(props)).toBe('saved data')
  })

  it.each([401, 403, 404])('does not disguise status %s as a service outage', async status => {
    vi.mocked(getOrchestratorPageHealth).mockResolvedValue(health(true))
    const error = new OrchestratorRequestError('denied or missing', status)
    await expect(
      OrchestratorPageBoundary({ load: () => Promise.reject(error), children: () => 'ready', fallback: 'offline' })
    ).rejects.toBe(error)
  })

  it('does not disguise programming errors as service outages', async () => {
    vi.mocked(getOrchestratorPageHealth).mockResolvedValue(health(true))
    const error = new Error('unexpected')
    await expect(
      OrchestratorPageBoundary({ load: () => Promise.reject(error), children: () => 'ready', fallback: 'offline' })
    ).rejects.toBe(error)
  })
})
