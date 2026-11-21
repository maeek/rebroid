import { describe, expect, it, vi } from 'vitest'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { readServiceContainers } from '@/server/orchestrator/platform/service-containers'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { loadPlatformServicesPageData } from './page-data.server'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/server/orchestrator/config', () => ({ getOrchestratorBaseUrl: () => 'http://runtime' }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({ getOrchestratorHealthSummaryAction: vi.fn() }))
vi.mock('@/server/orchestrator/get-server-ui-settings', () => ({ getRequiredServerOrchestratorUiSettings: vi.fn() }))

vi.mock('@/server/orchestrator/platform/service-containers', () => ({ readServiceContainers: vi.fn() }))

const health = (online: boolean, docker = false) =>
  ({ services: { orchestrator: { ok: online }, docker: { ok: docker } } }) as OrchestratorHealth

describe('Services page data availability', () => {
  it('skips settings when the orchestrator is unavailable', async () => {
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(health(false))
    const result = await loadPlatformServicesPageData()
    expect(result.initialHealth?.services.orchestrator.ok).toBe(false)
    expect(getRequiredServerOrchestratorUiSettings).not.toHaveBeenCalled()
  })

  it('does not expose editable defaults if settings fail after a healthy probe', async () => {
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(health(true))
    vi.mocked(getRequiredServerOrchestratorUiSettings).mockRejectedValue(
      new OrchestratorRequestError('offline', 503, 'settings-ref')
    )
    const result = await loadPlatformServicesPageData()
    expect(result.initialHealth).toBeNull()
    expect(result.requestId).toBe('settings-ref')
  })

  it('keeps infrastructure diagnostics independent from connection settings', async () => {
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(health(true))
    const result = await loadPlatformServicesPageData(Promise.resolve({ service: 'orchestrator' }))
    expect(result.initialHealth?.services.orchestrator.ok).toBe(true)
    expect(getRequiredServerOrchestratorUiSettings).not.toHaveBeenCalled()
  })

  it('returns service rows while optional Docker log links are pending', async () => {
    const containers = Promise.withResolvers<null>()
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(health(true, true))
    vi.mocked(getRequiredServerOrchestratorUiSettings).mockResolvedValue(defaultOrchestratorUiSettings)
    vi.mocked(readServiceContainers).mockReturnValue(containers.promise)

    const result = await loadPlatformServicesPageData()
    expect(result.initialHealth?.services.orchestrator.ok).toBe(true)
    expect(result.pendingContainers).toBe(containers.promise)
    containers.resolve(null)
    await expect(result.pendingContainers).resolves.toBeNull()
  })

  it('does not hide permission failures as offline health', async () => {
    const error = new OrchestratorRequestError('denied', 403)
    vi.mocked(getOrchestratorHealthSummaryAction).mockRejectedValue(error)
    await expect(loadPlatformServicesPageData()).rejects.toBe(error)
  })
})
