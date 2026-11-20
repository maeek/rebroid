import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { getPlatformOperations } from './operations-query'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/features', () => ({ loadFeatureFlags: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { listActiveRuns: vi.fn() }
}))
const user = { ownerUserId: 'owner', permissions: {} } as Awaited<ReturnType<typeof getCurrentUserContext>>
const runFields = { targetApplicationId: 'app', createdAt: '2026-01-01T00:00:00.000Z' }
beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue(undefined as never)
  vi.mocked(getCurrentUserContext).mockResolvedValue(user)
  vi.mocked(loadFeatureFlags).mockResolvedValue(null)
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
      id: `app-${index}`,
      name: `App ${index}`,
      updatedAt: new Date(index * 1000).toISOString(),
      status: { currentStatus: index < 8 ? 'error' : 'provisioning', lifecycleStage: 'queued' }
    }))
    vi.mocked(listApplicationsAction).mockResolvedValue([
      ...apps,
      {
        id: 'stopping',
        name: 'Stopping app',
        updatedAt: new Date(20_000).toISOString(),
        status: { currentStatus: 'running', lifecycleStage: 'stopping' }
      }
    ] as AndroidApplication[])
    const result = await getPlatformOperations()
    expect(result).toMatchObject({
      failedCount: 8,
      pendingCount: 9,
      activeRunCount: null,
      workflowCatalogAvailable: false
    })
    expect(result).not.toHaveProperty('failedApps')
    expect(result).not.toHaveProperty('pendingApps')
    expect(orchestratorAutomationsClient.listActiveRuns).not.toHaveBeenCalled()
  })

  it('counts the same owned, queued and running workflows as the active view', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      permissions: { 'automations:run': true, 'automations:manage': true }
    })
    vi.mocked(listApplicationsAction).mockResolvedValue([])
    vi.mocked(orchestratorAutomationsClient.listActiveRuns).mockResolvedValue([
      { ...runFields, id: 'queued', automationId: 'workflow', status: 'queued', workflowName: 'Inventory' },
      { ...runFields, id: 'running', automationId: 'workflow', status: 'running', workflowName: 'Inventory' },
      { ...runFields, id: 'ai-run', automationId: 'ephemeral-ai-run', status: 'running', workflowName: null }
    ])

    await expect(getPlatformOperations()).resolves.toMatchObject({
      failedCount: 0,
      pendingCount: 0,
      activeRunCount: 2,
      activeRuns: [
        { name: 'Inventory', impact: 'Queued', href: '/automations/workflow/traces?run=queued' },
        { name: 'Inventory', impact: 'Running', href: '/automations/workflow/traces?run=running' }
      ]
    })
    expect(orchestratorAutomationsClient.listActiveRuns).toHaveBeenCalledWith('owner')
  })

  it('keeps app counts available when workflows are disabled', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      permissions: { 'automations:run': true, 'automations:manage': true }
    })
    vi.mocked(listApplicationsAction).mockResolvedValue([])
    vi.mocked(orchestratorAutomationsClient.listActiveRuns).mockResolvedValue([
      { ...runFields, id: 'ai-run', automationId: 'ephemeral-ai-run', status: 'running', workflowName: null },
      { ...runFields, id: 'queued', automationId: 'workflow', status: 'queued', workflowName: null }
    ])

    await expect(getPlatformOperations()).resolves.toMatchObject({
      failedCount: 0,
      pendingCount: 0,
      activeRunCount: 1,
      activeRuns: [{ name: 'Workflow run' }],
      workflowCatalogAvailable: false
    })
  })
})
