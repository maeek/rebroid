import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/bff/preferences/ui-settings/route'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { saveRuntimeUiSettings } from './ui-settings-service'

vi.mock('@/server/preferences/ui-settings-service', () => ({
  readUiSettings: vi.fn(),
  resetGeneralUiSettings: vi.fn(),
  resetRuntimeUiSettings: vi.fn(),
  saveAiUiSettings: vi.fn(),
  saveGeneralUiSettings: vi.fn(),
  saveRuntimeUiSettings: vi.fn()
}))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => 'test-request' }))
vi.mock('@/server/observability/logger', () => ({ logger: { error: vi.fn() } }))

const request = (settings: unknown) =>
  new Request('https://localhost/api/bff/preferences/ui-settings', {
    method: 'POST',
    body: JSON.stringify({ operation: 'save-runtime', settings }),
    headers: { 'Content-Type': 'application/json' }
  })

beforeEach(() => vi.mocked(saveRuntimeUiSettings).mockResolvedValue(defaultOrchestratorUiSettings))

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
