import { beforeEach, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { request } from '@/server/orchestrator/request'
import { readAndroidRenderingSettings, saveAndroidRenderingSettings } from './android-rendering-settings'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/request', () => ({ request: vi.fn() }))

const settings = { mode: 'host', renderDevice: '/dev/dri/renderD128' }

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin', username: 'admin' } as Awaited<
    ReturnType<typeof requireAdmin>
  >)
  vi.mocked(request).mockResolvedValue(settings)
})

it('restricts rendering configuration reads and writes to administrators', async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
  await expect(readAndroidRenderingSettings()).rejects.toThrow('Forbidden')
  await expect(saveAndroidRenderingSettings(settings)).rejects.toThrow('Forbidden')
  expect(request).not.toHaveBeenCalled()
})

it('rejects an unsafe device before dispatch with a field error', async () => {
  await expect(
    saveAndroidRenderingSettings({ ...settings, renderDevice: '/dev/dri/renderD128:/dev/sda' })
  ).rejects.toMatchObject({
    code: 'validation',
    fieldErrors: { renderDevice: [expect.any(String)] }
  })
  expect(request).not.toHaveBeenCalled()
  expect(recordAuditEvent).not.toHaveBeenCalled()
})

it('dispatches the validated rendering configuration and audits the saved setting', async () => {
  await expect(saveAndroidRenderingSettings(settings)).resolves.toEqual(settings)
  expect(request).toHaveBeenCalledWith(
    '/settings/android-rendering',
    { method: 'PUT', body: JSON.stringify(settings) },
    expect.anything()
  )
  expect(recordAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      actorUserId: 'admin',
      action: 'settings.android_rendering.update',
      details: settings
    })
  )
})
