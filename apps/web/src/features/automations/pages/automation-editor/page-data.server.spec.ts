import { beforeEach, expect, it, vi } from 'vitest'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { loadWorkflowEditor } from './page-data.server'

vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { get: vi.fn(), listCommands: vi.fn() }
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'owner',
    isPlatformAdmin: false,
    permissions: { 'automations:manage': true, 'automations:run-ai': true }
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
  vi.mocked(orchestratorAutomationsClient.listCommands).mockResolvedValue([])
})

it('opens a new draft for the signed-in owner without reading a workflow', async () => {
  await expect(loadWorkflowEditor()).resolves.toMatchObject({
    ok: true,
    data: {
      initialAutomation: null,
      initialCommands: [],
      draftOwnerUserId: 'owner',
      canUseAi: true,
      canManageAi: false
    }
  })
  expect(orchestratorAutomationsClient.get).not.toHaveBeenCalled()
})

it('uses the not-found route for missing workflows before fetching commands', async () => {
  vi.mocked(orchestratorAutomationsClient.get).mockRejectedValue(new OrchestratorRequestError('Missing', 404, 'ref'))
  await expect(loadWorkflowEditor('gone')).rejects.toMatchObject({ digest: expect.stringContaining('404') })
  expect(orchestratorAutomationsClient.get).toHaveBeenCalledWith('owner', 'gone')
  expect(orchestratorAutomationsClient.listCommands).not.toHaveBeenCalled()
})

it('returns a support reference when only the command catalog is missing', async () => {
  vi.mocked(orchestratorAutomationsClient.listCommands).mockRejectedValue(
    new OrchestratorRequestError('internal', 404, 'ref')
  )
  const result = await loadWorkflowEditor()
  expect(result).toMatchObject({ ok: false, error: { code: 'not_found', requestId: result.requestId } })
  expect(result.requestId).toBeTruthy()
})

it('checks management access before either editor read', async () => {
  vi.mocked(getCurrentUserContext).mockResolvedValue({ ownerUserId: 'viewer', permissions: {} } as Awaited<
    ReturnType<typeof getCurrentUserContext>
  >)
  await expect(loadWorkflowEditor('id')).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } })
  expect(orchestratorAutomationsClient.get).not.toHaveBeenCalled()
  expect(orchestratorAutomationsClient.listCommands).not.toHaveBeenCalled()
})
