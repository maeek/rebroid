import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import {
  defaultOrchestratorUiSettings,
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse
} from '@/shared/model/settings/orchestrator-ui-settings'
import { saveRuntimeUiSettings } from './ui-settings-service'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/config', () => ({ getOrchestratorBaseUrl: () => 'http://orchestrator:4100' }))
vi.mock('@/server/orchestrator/settings/client', () => ({
  orchestratorSettingsClient: { getSettings: vi.fn(), updateSettings: vi.fn() }
}))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn(), saveWebSettings: vi.fn() }))

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin', username: 'admin', name: 'Admin' } as Awaited<
    ReturnType<typeof requireAdmin>
  >)
  vi.mocked(getWebSettings).mockResolvedValue(defaultWebSettingsResponse)
  vi.mocked(orchestratorSettingsClient.getSettings).mockResolvedValue(defaultRuntimeSettingsResponse)
})

describe('Runtime settings patch scope', () => {
  it('updates connections without resending stale runtime defaults or web settings', async () => {
    const services = {
      ...defaultOrchestratorUiSettings.services,
      ocr: { ...defaultOrchestratorUiSettings.services.ocr, endpoint: 'http://ocr:4300' }
    }
    await saveRuntimeUiSettings({ services })
    expect(orchestratorSettingsClient.updateSettings).toHaveBeenCalledExactlyOnceWith({ services })
    expect(saveWebSettings).not.toHaveBeenCalled()
  })

  it('updates runtime defaults without replacing service connections', async () => {
    await saveRuntimeUiSettings({ maxApkUploadSizeMb: 256, removeDataOnDelete: false })
    expect(orchestratorSettingsClient.updateSettings).toHaveBeenCalledExactlyOnceWith({ maxApkUploadSizeMb: 256 })
    expect(saveWebSettings).toHaveBeenCalledExactlyOnceWith({ removeDataOnDelete: false })
  })

  it('saves a web-owned deletion policy without calling the orchestrator update', async () => {
    await saveRuntimeUiSettings({ removeDataOnDelete: false })
    expect(saveWebSettings).toHaveBeenCalledExactlyOnceWith({ removeDataOnDelete: false })
    expect(orchestratorSettingsClient.updateSettings).not.toHaveBeenCalled()
  })

  it('does not save the deletion policy if the runtime update fails', async () => {
    vi.mocked(orchestratorSettingsClient.updateSettings).mockRejectedValueOnce(new Error('offline'))
    await expect(saveRuntimeUiSettings({ maxApkUploadSizeMb: 256, removeDataOnDelete: false })).rejects.toThrow(
      'offline'
    )
    expect(saveWebSettings).not.toHaveBeenCalled()
  })

  it('requires an administrator before changing either settings store', async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('forbidden'))
    await expect(saveRuntimeUiSettings({ services: defaultOrchestratorUiSettings.services })).rejects.toThrow(
      'forbidden'
    )
    expect(orchestratorSettingsClient.updateSettings).not.toHaveBeenCalled()
    expect(saveWebSettings).not.toHaveBeenCalled()
  })
})
