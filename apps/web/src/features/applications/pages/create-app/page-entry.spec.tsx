import { describe, expect, it, vi } from 'vitest'
import { ExternalDevicesPage } from '@/features/applications/pages/external-devices/page-client'
import { RegisterDevicePageEntry } from '@/features/applications/pages/register-device/page-entry'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { CreateAppPageEntry } from './page-entry'

const { loadExternalDeviceInventory, getCurrentUserContext } = vi.hoisted(() => ({
  loadExternalDeviceInventory: vi.fn(),
  getCurrentUserContext: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`Redirect to ${path}`)
  }
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext }))
vi.mock('@/server/orchestrator/external-devices/operations', () => ({ loadExternalDeviceInventory }))

describe('app creation and device registration', () => {
  it('opens app creation without checking the external broker', async () => {
    getCurrentUserContext.mockResolvedValue({
      permissions: { 'applications:create': true }
    })

    expect((await CreateAppPageEntry()).type).toBe(OrchestratorPageBoundary)
    expect(loadExternalDeviceInventory).not.toHaveBeenCalled()
    await expect(RegisterDevicePageEntry()).rejects.toThrow('Redirect to /devices')
  })

  it('uses its own enrollment permission and broker check for devices', async () => {
    getCurrentUserContext.mockResolvedValue({ permissions: { 'devices:enroll-external': true } })
    loadExternalDeviceInventory.mockResolvedValue({
      devices: [],
      availability: { enabled: true, status: 'available' },
      canEnroll: true,
      canConnect: true,
      administrator: false,
      userId: 'owner'
    })

    await expect(CreateAppPageEntry()).rejects.toThrow('Redirect to /apps')
    const page = await RegisterDevicePageEntry()
    expect(page).toMatchObject({ type: ExternalDevicesPage, props: { openRegistration: true } })
    expect(loadExternalDeviceInventory).toHaveBeenCalledOnce()
  })
})
