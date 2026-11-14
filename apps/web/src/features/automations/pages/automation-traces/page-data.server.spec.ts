import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { loadAutomationTracesPageData } from './page-data.server'
import type { AutomationRun } from '@/shared/contracts/automation'
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({ getAutomationAction: vi.fn() }))
vi.mock('@/server/orchestrator/automations/automation-run-actions', () => ({ listAutomationRunsAction: vi.fn() }))
vi.mock('@/server/orchestrator/automations/client', () => ({ orchestratorAutomationsClient: { getRun: vi.fn() } }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
beforeEach(() => {
  vi.mocked(getAutomationAction).mockResolvedValue({ id: 'workflow' } as Awaited<
    ReturnType<typeof getAutomationAction>
  >)
  vi.mocked(listApplicationsAction).mockResolvedValue([])
  vi.mocked(listAutomationRunsAction).mockResolvedValue([])
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'owner',
    permissions: { 'automations:manage': true, 'automations:run': true }
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
})
describe('selected historical automation run', () => {
  it('loads an older run within its authenticated workflow', async () => {
    const selected = { id: 'old-run', automationId: 'workflow' } as AutomationRun
    vi.mocked(orchestratorAutomationsClient.getRun).mockResolvedValue(selected)
    expect((await loadAutomationTracesPageData('workflow', 'old-run')).runs).toEqual([selected])
    expect(orchestratorAutomationsClient.getRun).toHaveBeenCalledWith('owner', 'old-run')
  })
  it('keeps the selected run accessible when the workflow catalog is disabled', async () => {
    const selected = { id: 'active-run', automationId: 'workflow', status: 'running' } as AutomationRun
    vi.mocked(getAutomationAction).mockRejectedValue(
      new OrchestratorRequestError('Disabled', 409, 'request', { code: 'feature_disabled' })
    )
    vi.mocked(orchestratorAutomationsClient.getRun).mockResolvedValue(selected)
    await expect(loadAutomationTracesPageData('workflow', selected.id)).resolves.toMatchObject({
      automation: null,
      runs: [selected]
    })
  })
  it('does not expose a run belonging to another workflow', async () => {
    vi.mocked(orchestratorAutomationsClient.getRun).mockResolvedValue({
      id: 'other-run',
      automationId: 'other-workflow'
    } as AutomationRun)
    expect((await loadAutomationTracesPageData('workflow', 'other-run')).runs).toEqual([])
  })
  it('does not query malformed run identifiers', async () => {
    expect((await loadAutomationTracesPageData('workflow', '../run')).runs).toEqual([])
    expect(orchestratorAutomationsClient.getRun).not.toHaveBeenCalled()
  })
})
