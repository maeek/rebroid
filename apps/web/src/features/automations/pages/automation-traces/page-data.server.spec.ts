import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listApplicationNames } from '@/server/orchestrator/applications/application-gallery-query'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { loadAutomationTracesPageData } from './page-data.server'
import type { AutomationRun } from '@/shared/contracts/automation'
vi.mock('@/server/orchestrator/applications/application-gallery-query', () => ({
  listApplicationNames: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/automation-management-actions', () => ({ getAutomationAction: vi.fn() }))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { getRun: vi.fn(), listRunHistory: vi.fn() }
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
beforeEach(() => {
  vi.mocked(getAutomationAction).mockResolvedValue({ id: 'workflow' } as Awaited<
    ReturnType<typeof getAutomationAction>
  >)
  vi.mocked(listApplicationNames).mockResolvedValue([])
  vi.mocked(orchestratorAutomationsClient.listRunHistory).mockResolvedValue([])
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'owner',
    permissions: { 'automations:manage': true, 'automations:run': true }
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
})
describe('selected historical automation run', () => {
  it('lists lean run history when no run is selected', async () => {
    const result = await loadAutomationTracesPageData('workflow')
    expect(result.runs).toEqual([])
    expect(orchestratorAutomationsClient.listRunHistory).toHaveBeenCalledWith('owner', 'workflow', 50)
    expect(orchestratorAutomationsClient.getRun).not.toHaveBeenCalled()
  })

  it('loads an older run within its authenticated workflow', async () => {
    const selected = { id: 'old-run', automationId: 'workflow' } as AutomationRun
    vi.mocked(orchestratorAutomationsClient.getRun).mockResolvedValue(selected)
    expect((await loadAutomationTracesPageData('workflow', 'old-run')).selectedRun).toEqual(selected)
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
      selectedRun: selected
    })
  })
  it('does not expose a run belonging to another workflow', async () => {
    vi.mocked(orchestratorAutomationsClient.getRun).mockResolvedValue({
      id: 'other-run',
      automationId: 'other-workflow'
    } as AutomationRun)
    expect((await loadAutomationTracesPageData('workflow', 'other-run')).selectedRun).toBeUndefined()
  })
  it('does not query malformed run identifiers', async () => {
    expect((await loadAutomationTracesPageData('workflow', '../run')).selectedRun).toBeUndefined()
    expect(orchestratorAutomationsClient.getRun).not.toHaveBeenCalled()
  })
})
