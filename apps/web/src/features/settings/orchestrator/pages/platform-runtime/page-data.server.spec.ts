import { unstable_rethrow } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'
import { getOrchestratorSettingsAction } from '@/server/orchestrator/settings/actions'
import { getWebSettings } from '@/server/web-settings/store'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse
} from '@/shared/model/settings/orchestrator-ui-settings'
import { getPlatformRuntimePageData } from './page-data.server'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

const healthyService = { ok: true, status: 'healthy', message: 'Available' } as const
const servicesPreviewHealth: OrchestratorHealth = {
  ok: true,
  docker: true,
  runtime: true,
  display: true,
  firewall: true,
  ocr: true,
  services: {
    orchestrator: healthyService,
    docker: healthyService,
    runtime: healthyService,
    display: healthyService,
    firewall: healthyService,
    ocr: healthyService
  }
}

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/server/orchestrator/config', () => ({ getOrchestratorBaseUrl: () => 'http://runtime:4100' }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({ getOrchestratorHealthSummaryAction: vi.fn() }))
vi.mock('@/server/orchestrator/platform/image-actions', () => ({ listPlatformImagesAction: vi.fn() }))
vi.mock('@/server/orchestrator/settings/actions', () => ({ getOrchestratorSettingsAction: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))

beforeEach(() => {
  vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(servicesPreviewHealth)
  vi.mocked(getWebSettings).mockResolvedValue(defaultWebSettingsResponse)
  vi.mocked(getOrchestratorSettingsAction).mockResolvedValue(defaultRuntimeSettingsResponse)
  vi.mocked(listPlatformImagesAction).mockResolvedValue([])
})

describe('runtime defaults availability', () => {
  it('stops dependent reads after a failed health check', async () => {
    vi.mocked(getOrchestratorHealthSummaryAction).mockRejectedValueOnce(new Error('offline'))
    expect(await getPlatformRuntimePageData()).toBeNull()
    expect(getOrchestratorSettingsAction).not.toHaveBeenCalled()
    expect(listPlatformImagesAction).not.toHaveBeenCalled()
  })

  it.each(['orchestrator', 'docker'] as const)('stops reads when %s is offline', async service => {
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValueOnce({
      ...servicesPreviewHealth,
      services: { ...servicesPreviewHealth.services, [service]: { ok: false, status: 'offline', message: 'Offline' } }
    })
    expect(await getPlatformRuntimePageData()).toBeNull()
    expect(getOrchestratorSettingsAction).not.toHaveBeenCalled()
    expect(listPlatformImagesAction).not.toHaveBeenCalled()
  })

  it('does not substitute editable defaults for failed reads and fetches saved settings on retry', async () => {
    vi.mocked(getOrchestratorSettingsAction).mockRejectedValueOnce(new Error('unavailable'))
    expect(await getPlatformRuntimePageData()).toBeNull()
    vi.mocked(getOrchestratorSettingsAction).mockResolvedValueOnce({
      ...defaultRuntimeSettingsResponse,
      maxApkUploadSizeMb: 128
    })
    const data = await getPlatformRuntimePageData()
    expect(data?.initialSettings.maxApkUploadSizeMb).toBe(128)
    expect(data?.initialSettings.orchestratorApiUrl).toBe('http://runtime:4100')
  })

  it('preserves framework redirects', async () => {
    const redirect = new Error('redirect')
    vi.mocked(getOrchestratorHealthSummaryAction).mockRejectedValueOnce(redirect)
    vi.mocked(unstable_rethrow).mockImplementationOnce(() => {
      throw redirect
    })
    await expect(getPlatformRuntimePageData()).rejects.toThrow(redirect)
  })
})
