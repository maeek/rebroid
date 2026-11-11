import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/bff/preferences/ui-settings/route'
import { getCurrentUser } from '@/server/auth/authorization'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { getWebSettings } from '@/server/web-settings/store'
import {
  defaultOrchestratorUiSettings,
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse
} from '@/shared/model/settings/orchestrator-ui-settings'
import { saveRuntimeUiSettings } from './ui-settings-service'

vi.mock('@/server/preferences/ui-settings-service', () => ({
  resetGeneralUiSettings: vi.fn(),
  resetRuntimeUiSettings: vi.fn(),
  saveAiUiSettings: vi.fn(),
  saveGeneralUiSettings: vi.fn(),
  saveRuntimeUiSettings: vi.fn()
}))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => 'test-request' }))
vi.mock('@/server/observability/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn()
}))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/server/orchestrator/config', () => ({ getOrchestratorBaseUrl: () => 'http://orchestrator:4100' }))
vi.mock('@/server/orchestrator/settings/client', () => ({
  orchestratorSettingsClient: { getSettings: vi.fn() }
}))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))

const request = (settings: unknown) =>
  new Request('https://localhost/api/bff/preferences/ui-settings', {
    method: 'POST',
    body: JSON.stringify({ operation: 'save-runtime', settings }),
    headers: { 'Content-Type': 'application/json' }
  })

beforeEach(() => vi.mocked(saveRuntimeUiSettings).mockResolvedValue(defaultOrchestratorUiSettings))

describe('Browser settings reads', () => {
  beforeEach(() => {
    vi.mocked(getWebSettings).mockResolvedValue({ ...defaultWebSettingsResponse, auditRetentionDays: 41 })
    vi.mocked(orchestratorSettingsClient.getSettings).mockResolvedValue({
      ...defaultRuntimeSettingsResponse,
      dockerImageRegistry: 'registry.internal',
      services: {
        ...defaultRuntimeSettingsResponse.services,
        ocr: { ...defaultRuntimeSettingsResponse.services.ocr, endpoint: 'http://ocr.internal' }
      }
    })
  })

  it.each(['admin', 'user'] as const)('applies the same audience policy to BFF and page reads for %s', async role => {
    vi.mocked(getCurrentUser).mockResolvedValue({ role } as Awaited<ReturnType<typeof getCurrentUser>>)
    const settings = await getRequiredServerOrchestratorUiSettings()
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, data: settings })
    expect(settings).toMatchObject({
      orchestratorApiUrl: role === 'admin' ? 'http://orchestrator:4100' : '',
      dockerImageRegistry: role === 'admin' ? 'registry.internal' : null,
      auditRetentionDays: role === 'admin' ? 41 : defaultWebSettingsResponse.auditRetentionDays,
      services: {
        ocr: { endpoint: role === 'admin' ? 'http://ocr.internal' : null },
        firewall: { endpoint: role === 'admin' ? defaultOrchestratorUiSettings.services.firewall.endpoint : null }
      }
    })
  })

  it('uses defaults for optional reads and propagates required read failures', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(orchestratorSettingsClient.getSettings).mockRejectedValue(new Error('offline'))
    await expect(getRequiredServerOrchestratorUiSettings()).rejects.toThrow('offline')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { defaultContainerImage: defaultOrchestratorUiSettings.defaultContainerImage, orchestratorApiUrl: '' }
    })
  })

  it('checks authentication before loading protected settings', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Authentication required'))
    await expect(getRequiredServerOrchestratorUiSettings()).rejects.toThrow('Authentication required')
    expect(getWebSettings).not.toHaveBeenCalled()
    expect(orchestratorSettingsClient.getSettings).not.toHaveBeenCalled()
  })
})

describe('Runtime settings BFF validation', () => {
  it.each([
    { services: defaultOrchestratorUiSettings.services },
    { defaultContainerImage: 'local/runtime:latest' },
    { removeDataOnDelete: false }
  ])('accepts a scoped update %o', async settings => {
    const response = await POST(request(settings))
    expect(response.status).toBe(200)
    expect(saveRuntimeUiSettings).toHaveBeenCalledExactlyOnceWith(settings)
  })

  it.each([
    {},
    { unknown: true },
    { maxApkUploadSizeMb: 0 },
    { maxApkUploadSizeMb: 4097 },
    { defaultContainerImage: '' },
    {
      services: {
        ocr: { ...defaultOrchestratorUiSettings.services.ocr, timeoutMs: 0 },
        firewall: defaultOrchestratorUiSettings.services.firewall
      }
    },
    {
      services: {
        ocr: { ...defaultOrchestratorUiSettings.services.ocr, minConfidence: 2 },
        firewall: defaultOrchestratorUiSettings.services.firewall
      }
    }
  ])('rejects invalid or empty updates %o before persistence', async settings => {
    const response = await POST(request(settings))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'validation', requestId: 'test-request' } })
    expect(saveRuntimeUiSettings).not.toHaveBeenCalled()
  })
})
