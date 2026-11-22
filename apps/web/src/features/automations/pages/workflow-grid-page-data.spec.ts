import { beforeEach, expect, it, vi } from 'vitest'
import { listApplicationNames } from '@/server/orchestrator/applications/application-gallery-query'
import { listVisibleApplications } from '@/server/orchestrator/applications/application-list-query'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { applicationPreview } from '@/shared/testing/application-preview'
import { loadAutomationTriggersPageData } from './automation-triggers/page-data.server'
import { loadAutomationsListPageData } from './automations-list/page-data.server'

vi.mock('@/server/orchestrator/applications/application-list-query', () => ({
  listVisibleApplications: vi.fn()
}))
vi.mock('@/server/orchestrator/applications/application-gallery-query', () => ({ listApplicationNames: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/scheduled-tasks/workflow-history-retention', () => ({
  loadWorkflowHistoryRetention: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { listGrid: vi.fn(), listOptions: vi.fn(), listTriggersGrid: vi.fn() }
}))

beforeEach(() => vi.resetAllMocks())

it.each([loadAutomationsListPageData, loadAutomationTriggersPageData])(
  'requires management access before any inventory read',
  async load => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ ownerUserId: 'viewer', permissions: {} } as Awaited<
      ReturnType<typeof getCurrentUserContext>
    >)
    await expect(load({})).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(listApplicationNames).not.toHaveBeenCalled()
    expect(listVisibleApplications).not.toHaveBeenCalled()
    expect(orchestratorAutomationsClient.listOptions).not.toHaveBeenCalled()
    expect(orchestratorAutomationsClient.listTriggersGrid).not.toHaveBeenCalled()
    expect(orchestratorAutomationsClient.listGrid).not.toHaveBeenCalled()
  }
)

it.each([loadAutomationsListPageData, loadAutomationTriggersPageData])(
  'returns a support reference when an inventory read fails',
  async load => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ownerUserId: 'owner',
      permissions: { 'automations:manage': true }
    } as Awaited<ReturnType<typeof getCurrentUserContext>>)
    vi.mocked(listApplicationNames).mockRejectedValue(new Error('internal address'))
    vi.mocked(listVisibleApplications).mockRejectedValue(new Error('internal address'))
    const result = await load({})
    expect(result).toMatchObject({ ok: false, error: { requestId: result.requestId, code: 'internal' } })
    expect(result.requestId).toBeTruthy()
    expect(JSON.stringify(result)).not.toContain('internal address')
  }
)

it('sends visible names to the grid and profile options only for owned targets', async () => {
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: applicationPreview.ownerUserId,
    permissions: { 'automations:manage': true }
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
  const other = { ...applicationPreview, id: 'other', name: 'Other app', ownerUserId: 'another-user' }
  vi.mocked(listVisibleApplications).mockResolvedValue([applicationPreview, other])
  const result = await loadAutomationTriggersPageData({})
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  expect(result.data.applications).toEqual([applicationPreview, other].map(({ id, name }) => ({ id, name })))
  expect(result.data.targetApps).toEqual([
    {
      id: applicationPreview.id,
      name: applicationPreview.name,
      runtime: { image: applicationPreview.runtime.image },
      apk: { packageName: applicationPreview.apk.packageName },
      storage: {
        profileName: 'default',
        profileMode: 'persistent',
        savedProfiles: applicationPreview.storage.savedProfiles
      }
    }
  ])
})
