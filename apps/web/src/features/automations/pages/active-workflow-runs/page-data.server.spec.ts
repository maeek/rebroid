import { describe, expect, it, vi } from 'vitest'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { listActiveWorkflowRuns } from '@/server/orchestrator/automations/active-workflow-runs-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { loadActiveWorkflowRuns } from './page-data.server'
import type { AndroidApplicationSummary } from '@/shared/contracts/application'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('Not found')
  }
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { listApplicationSummaries: vi.fn() }
}))
vi.mock('@/server/orchestrator/automations/active-workflow-runs-query', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/automations/active-workflow-runs-query')>()),
  listActiveWorkflowRuns: vi.fn()
}))

const user = {
  ownerUserId: 'owner',
  permissions: { 'automations:manage': true }
} as Awaited<ReturnType<typeof getCurrentUserContext>>

describe('active workflow run page data', () => {
  it('checks both permissions before reading runs or apps', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user)

    await expect(loadActiveWorkflowRuns()).rejects.toThrow('Not found')
    expect(listActiveWorkflowRuns).not.toHaveBeenCalled()
    expect(orchestratorAppCatalogClient.listApplicationSummaries).not.toHaveBeenCalled()
  })

  it('loads the account’s active runs and returns names only for their targets', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      permissions: { ...user.permissions, 'automations:run': true }
    })
    vi.mocked(listActiveWorkflowRuns).mockResolvedValue([
      {
        id: 'run',
        automationId: 'workflow',
        workflowName: 'Inventory',
        targetApplicationId: 'target',
        status: 'queued',
        createdAt: '2026-11-12T12:00:00Z'
      }
    ])
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockResolvedValue([
      { id: 'target', name: 'Warehouse scanner' },
      { id: 'other', name: 'Other app' }
    ] as AndroidApplicationSummary[])

    const { targets } = await loadActiveWorkflowRuns()
    expect(targets).toEqual({ target: 'Warehouse scanner' })
    expect(listActiveWorkflowRuns).toHaveBeenCalledWith('owner')
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledWith('owner')
  })
})
