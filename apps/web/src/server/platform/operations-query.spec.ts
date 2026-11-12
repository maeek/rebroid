import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { getPlatformOperations } from './operations-query'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationRun } from '@/shared/contracts/automation'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { listActiveRuns: vi.fn(), list: vi.fn() }
}))
const user = { ownerUserId: 'owner', permissions: {} } as Awaited<ReturnType<typeof getCurrentUserContext>>
beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue(undefined as never)
  vi.mocked(getCurrentUserContext).mockResolvedValue(user)
})
describe('getPlatformOperations', () => {
  it('rejects access before reading any platform resources', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
    await expect(getPlatformOperations()).rejects.toThrow('Forbidden')
    expect(listApplicationsAction).not.toHaveBeenCalled()
    expect(orchestratorAutomationsClient.listActiveRuns).not.toHaveBeenCalled()
  })
  it('counts failures and all in-progress apps including stopping apps', async () => {
    const apps = Array.from({ length: 16 }, (_, index) => ({
      status: { currentStatus: index < 8 ? 'error' : 'provisioning', lifecycleStage: 'queued' }
    }))
    vi.mocked(listApplicationsAction).mockResolvedValue([
      ...apps,
      { status: { currentStatus: 'running', lifecycleStage: 'stopping' } }
    ] as AndroidApplication[])
    const result = await getPlatformOperations()
    expect(result).toEqual({ failedCount: 8, pendingCount: 9, activeRunCount: 0 })
    expect(orchestratorAutomationsClient.listActiveRuns).not.toHaveBeenCalled()
  })

  it('counts the same owned, queued and running workflows as the active view', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      permissions: { 'automations:run': true, 'automations:manage': true }
    })
    vi.mocked(listApplicationsAction).mockResolvedValue([])
    vi.mocked(orchestratorAutomationsClient.listActiveRuns).mockResolvedValue([
      { automationId: 'workflow', status: 'queued' },
      { automationId: 'workflow', status: 'running' },
      { automationId: 'workflow', status: 'success' },
      { automationId: 'ephemeral-ai-run', status: 'running' }
    ] as AutomationRun[])
    vi.mocked(orchestratorAutomationsClient.list).mockResolvedValue([
      { id: 'workflow', name: 'Inventory' } as Automation
    ])

    await expect(getPlatformOperations()).resolves.toEqual({ failedCount: 0, pendingCount: 0, activeRunCount: 2 })
    expect(orchestratorAutomationsClient.listActiveRuns).toHaveBeenCalledWith('owner')
    expect(orchestratorAutomationsClient.list).toHaveBeenCalledWith('owner')
  })

  it('keeps app counts available when workflows are disabled', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      permissions: { 'automations:run': true, 'automations:manage': true }
    })
    vi.mocked(listApplicationsAction).mockResolvedValue([])
    vi.mocked(orchestratorAutomationsClient.listActiveRuns).mockResolvedValue([
      { automationId: 'ephemeral-ai-run', status: 'running' }
    ] as AutomationRun[])
    vi.mocked(orchestratorAutomationsClient.list).mockRejectedValue(
      new OrchestratorRequestError('Workflows are disabled', 409, 'request', { code: 'feature_disabled' })
    )

    await expect(getPlatformOperations()).resolves.toEqual({ failedCount: 0, pendingCount: 0, activeRunCount: 0 })
  })
})
