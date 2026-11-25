import { beforeEach, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { orchestratorAppCatalogClient } from '../applications/catalog-client'
import { updateAutomationTriggerAction } from './automation-trigger-actions'
import { orchestratorAutomationsClient } from './client'
import type { Automation, AutomationTrigger } from '@/shared/contracts/automation'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('../applications/catalog-client', () => ({ orchestratorAppCatalogClient: { getViewerRuntime: vi.fn() } }))
vi.mock('./client', () => ({
  orchestratorAutomationsClient: { getTrigger: vi.fn(), get: vi.fn(), listCommands: vi.fn(), updateTrigger: vi.fn() }
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'owner',
    permissions: { 'automations:manage': true }
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
  vi.mocked(orchestratorAutomationsClient.getTrigger).mockResolvedValue({
    id: 'trigger',
    automationId: 'workflow',
    targetDeviceId: 'app',
    profileName: 'saved',
    profileMode: 'persistent'
  } as AutomationTrigger)
  vi.mocked(orchestratorAppCatalogClient.getViewerRuntime).mockResolvedValue({
    ownerUserId: 'owner',
    deviceId: 'app',
    kind: 'managed',
    runtimeId: null
  })
})

it('checks the saved profile for omitted fields in a trigger patch', async () => {
  await expect(
    updateAutomationTriggerAction('trigger', { enabled: true, profileName: undefined, profileMode: undefined })
  ).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } })
  expect(orchestratorAppCatalogClient.getViewerRuntime).toHaveBeenCalledWith('app')
  expect(orchestratorAutomationsClient.updateTrigger).not.toHaveBeenCalled()
})

it('preserves explicit profile clears and audits only fields sent to the orchestrator', async () => {
  vi.mocked(orchestratorAutomationsClient.get).mockResolvedValue({
    definition: { spec: { steps: [] } }
  } as unknown as Automation)
  vi.mocked(orchestratorAutomationsClient.listCommands).mockResolvedValue([])
  vi.mocked(orchestratorAutomationsClient.updateTrigger).mockResolvedValue({
    id: 'trigger',
    name: 'Daily'
  } as AutomationTrigger)
  await updateAutomationTriggerAction('trigger', { profileMode: null, profileName: null, description: undefined })
  expect(orchestratorAutomationsClient.updateTrigger).toHaveBeenCalledWith('owner', 'trigger', {
    profileMode: null,
    profileName: null
  })
  expect(recordAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      actorUserId: 'owner',
      resourceId: 'trigger',
      details: { fields: ['profileMode', 'profileName'] }
    })
  )
})
