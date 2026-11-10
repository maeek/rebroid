import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userService } from '@/server/auth/user'
import { orchestratorAppCatalogClient as apps } from '@/server/orchestrator/applications/catalog-client'
import { orchestratorAutomationsClient as workflows } from '@/server/orchestrator/automations/client'
import { authorizeAutomationExecution } from './authorize-execution'
vi.mock('@/server/auth/user', () => ({ userService: { getUserById: vi.fn() } }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { getApplication: vi.fn(), listApplications: vi.fn() }
}))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { listCommands: vi.fn(), listActiveRuns: vi.fn() }
}))
const input = {
  ownerUserId: 'user',
  targetApplicationId: 'app',
  operation: 'attach',
  definition: { spec: { steps: [{ uses: 'android.wait', with: {} }] } }
} as Parameters<typeof authorizeAutomationExecution>[0]
const account = {
  id: 'user',
  role: 'user',
  disabled: false,
  passwordChangeRequired: false,
  effectivePermissions: { 'automations:run': true },
  effectiveQuotas: { maxOpenApps: 1 }
}
describe('execution authorization', () => {
  beforeEach(() => {
    vi.mocked(userService.getUserById).mockResolvedValue(account as never)
    vi.mocked(apps.getApplication).mockResolvedValue({
      id: 'app',
      ownerUserId: 'user',
      status: { currentStatus: 'running' }
    } as never)
    vi.mocked(workflows.listCommands).mockResolvedValue([
      { uses: 'android.wait', requiredPermissions: ['automations:run'] }
    ] as never)
  })
  it('allows permitted steps against an owned running target', async () => {
    await expect(authorizeAutomationExecution(input)).resolves.toBe(1)
  })
  it.each([null, { ...account, disabled: true }, { ...account, passwordChangeRequired: true }])(
    'denies missing or disabled accounts and required password changes',
    async value => {
      vi.mocked(userService.getUserById).mockResolvedValue(value as never)
      await expect(authorizeAutomationExecution(input)).rejects.toThrow()
      expect(apps.getApplication).not.toHaveBeenCalled()
    }
  )
  it('rechecks revoked command permissions', async () => {
    vi.mocked(workflows.listCommands).mockResolvedValue([
      { uses: 'android.wait', requiredPermissions: ['automations:run-adb-shell'] }
    ] as never)
    await expect(authorizeAutomationExecution(input)).rejects.toThrow()
  })
  it('denies foreign targets', async () => {
    vi.mocked(apps.getApplication).mockResolvedValue({
      ownerUserId: 'other',
      status: { currentStatus: 'running' }
    } as never)
    await expect(authorizeAutomationExecution(input)).rejects.toThrow()
  })
  it('requires application start permission even if the catalog now shows a running target', async () => {
    vi.mocked(apps.getApplication).mockResolvedValue({
      id: 'app',
      ownerUserId: 'user',
      status: { currentStatus: 'running' },
      runtime: { resources: { memoryLimitMb: 128, cpuLimitCpus: 1 }, inactivityTimeoutSeconds: 60 }
    } as never)
    await expect(authorizeAutomationExecution({ ...input, operation: 'start' })).rejects.toThrow()
  })
  it('counts queued target reservations when enforcing startup quotas', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({
      ...account,
      effectivePermissions: { ...account.effectivePermissions, 'applications:start': true }
    } as never)
    vi.mocked(apps.getApplication).mockResolvedValue({
      id: 'app',
      ownerUserId: 'user',
      status: { currentStatus: 'running' },
      runtime: { resources: { memoryLimitMb: 128, cpuLimitCpus: 1 }, inactivityTimeoutSeconds: 60 }
    } as never)
    vi.mocked(apps.listApplications).mockResolvedValue([])
    vi.mocked(workflows.listActiveRuns).mockResolvedValue([{ targetApplicationId: 'other' }] as never)
    await expect(authorizeAutomationExecution({ ...input, operation: 'start' })).rejects.toThrow('quota')
  })
  it('checks permission when the profile was explicitly selected', async () => {
    await expect(authorizeAutomationExecution({ ...input, profileMode: 'persistent' })).rejects.toThrow('profiles')
  })
})
