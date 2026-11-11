import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import {
  defaultOrchestratorUiSettings,
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse
} from '@/shared/model/settings/orchestrator-ui-settings'
import { resetGeneralUiSettings, resetRuntimeUiSettings, saveRuntimeUiSettings } from './ui-settings-service'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/config', () => ({ getOrchestratorBaseUrl: () => 'http://orchestrator:4100' }))
vi.mock('@/server/orchestrator/settings/client', () => ({
  orchestratorSettingsClient: { getSettings: vi.fn(), updateSettings: vi.fn(), resetSettings: vi.fn() }
}))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn(), saveWebSettings: vi.fn() }))

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin', username: 'admin', name: 'Admin' } as Awaited<
    ReturnType<typeof requireAdmin>
  >)
  vi.mocked(getWebSettings).mockResolvedValue(defaultWebSettingsResponse)
  vi.mocked(orchestratorSettingsClient.getSettings).mockResolvedValue(defaultRuntimeSettingsResponse)
  vi.mocked(orchestratorSettingsClient.updateSettings).mockResolvedValue(defaultRuntimeSettingsResponse)
  vi.mocked(orchestratorSettingsClient.resetSettings).mockResolvedValue(defaultRuntimeSettingsResponse)
  vi.mocked(saveWebSettings).mockResolvedValue({ ...defaultWebSettingsResponse, removeDataOnDelete: false })
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
    const androidRendering = { mode: 'host', renderDevice: '/dev/dri/renderD128' } as const
    vi.mocked(orchestratorSettingsClient.updateSettings).mockResolvedValueOnce({
      ...defaultRuntimeSettingsResponse,
      androidRendering,
      maxApkUploadSizeMb: 256
    })
    await expect(
      saveRuntimeUiSettings({ androidRendering, maxApkUploadSizeMb: 256, removeDataOnDelete: false })
    ).resolves.toMatchObject({ androidRendering, maxApkUploadSizeMb: 256, removeDataOnDelete: false })
    expect(orchestratorSettingsClient.updateSettings).toHaveBeenCalledExactlyOnceWith({
      androidRendering,
      maxApkUploadSizeMb: 256
    })
    expect(saveWebSettings).toHaveBeenCalledExactlyOnceWith({ removeDataOnDelete: false })
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'settings.android_rendering.update', details: androidRendering })
    )
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

  it('returns authoritative settings from both writes without reading them back', async () => {
    vi.mocked(orchestratorSettingsClient.updateSettings).mockResolvedValueOnce({
      ...defaultRuntimeSettingsResponse,
      maxApkUploadSizeMb: 256
    })
    vi.mocked(orchestratorSettingsClient.getSettings).mockRejectedValue(new Error('Runtime settings unavailable'))
    vi.mocked(getWebSettings)
      .mockResolvedValueOnce(defaultWebSettingsResponse)
      .mockRejectedValue(new Error('Web settings unavailable'))

    await expect(saveRuntimeUiSettings({ maxApkUploadSizeMb: 256, removeDataOnDelete: false })).resolves.toMatchObject({
      maxApkUploadSizeMb: 256,
      removeDataOnDelete: false
    })
    expect(orchestratorSettingsClient.getSettings).not.toHaveBeenCalled()
    expect(getWebSettings).toHaveBeenCalledOnce()
  })

  it('reports which settings were saved when the deletion policy write fails', async () => {
    vi.mocked(saveWebSettings).mockRejectedValueOnce(new Error('Private database detail'))

    await expect(saveRuntimeUiSettings({ maxApkUploadSizeMb: 256, removeDataOnDelete: false })).rejects.toMatchObject({
      message: 'Runtime settings were saved. The app data deletion policy could not be saved. Try saving again.',
      code: 'internal',
      status: 500
    })
    expect(orchestratorSettingsClient.updateSettings).toHaveBeenCalledExactlyOnceWith({ maxApkUploadSizeMb: 256 })
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'settings.runtime.update',
        outcome: 'failure',
        details: { runtimeSettingsSaved: true, deletionPolicySaved: false }
      })
    )
  })

  it('does not reset runtime settings if the unchanged web settings cannot be read', async () => {
    vi.mocked(getWebSettings).mockRejectedValueOnce(new Error('Web settings unavailable'))

    await expect(resetRuntimeUiSettings()).rejects.toThrow('Web settings unavailable')
    expect(orchestratorSettingsClient.resetSettings).not.toHaveBeenCalled()
  })

  it('returns config-backed restored values and the unchanged deletion policy', async () => {
    vi.mocked(getWebSettings).mockResolvedValueOnce({ ...defaultWebSettingsResponse, removeDataOnDelete: false })
    vi.mocked(orchestratorSettingsClient.resetSettings).mockResolvedValueOnce({
      ...defaultRuntimeSettingsResponse,
      defaultContainerImage: 'local/runtime:latest',
      maxApkUploadSizeMb: 128,
      services: {
        ...defaultRuntimeSettingsResponse.services,
        firewall: { endpoint: null, timeoutMs: 5000 }
      }
    })
    vi.mocked(orchestratorSettingsClient.getSettings).mockRejectedValue(new Error('Runtime settings unavailable'))

    await expect(resetRuntimeUiSettings()).resolves.toMatchObject({
      defaultContainerImage: 'local/runtime:latest',
      maxApkUploadSizeMb: 128,
      removeDataOnDelete: false,
      services: { firewall: { endpoint: null } }
    })
    expect(orchestratorSettingsClient.getSettings).not.toHaveBeenCalled()
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

describe('Console defaults reset scope', () => {
  it('restores only the console defaults shown in General preferences', async () => {
    await resetGeneralUiSettings()

    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(saveWebSettings).toHaveBeenCalledExactlyOnceWith({
      appListRefreshIntervalSeconds: defaultWebSettingsResponse.appListRefreshIntervalSeconds,
      defaultViewerPreset: defaultWebSettingsResponse.defaultViewerPreset,
      defaultViewerBitrateMbps: defaultWebSettingsResponse.defaultViewerBitrateMbps,
      defaultViewerMaxFps: defaultWebSettingsResponse.defaultViewerMaxFps,
      defaultViewerMaxSize: defaultWebSettingsResponse.defaultViewerMaxSize,
      defaultViewerIFrameInterval: defaultWebSettingsResponse.defaultViewerIFrameInterval,
      defaultViewerKeyboardCaptureEnabled: defaultWebSettingsResponse.defaultViewerKeyboardCaptureEnabled,
      defaultViewerSoundEnabled: defaultWebSettingsResponse.defaultViewerSoundEnabled
    })
    expect(orchestratorSettingsClient.resetSettings).not.toHaveBeenCalled()
  })

  it('requires an administrator before restoring defaults', async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('forbidden'))

    await expect(resetGeneralUiSettings()).rejects.toThrow('forbidden')
    expect(saveWebSettings).not.toHaveBeenCalled()
  })
})
