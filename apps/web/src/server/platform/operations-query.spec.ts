import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getPlatformOperations } from './operations-query'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/automations/client', () => ({
  orchestratorAutomationsClient: { listActiveRuns: vi.fn() }
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
  it('bounds previews, preserves totals, and omits fields unrelated to operations', async () => {
    vi.mocked(listApplicationsAction).mockResolvedValue(
      Array.from(
        { length: 8 },
        (_, index) =>
          ({
            id: String(index),
            name: `App ${index}`,
            status: { currentStatus: 'error', detail: { description: 'Boot failed' } },
            errors: { internal: 'private' }
          }) as unknown as AndroidApplication
      )
    )
    const result = await getPlatformOperations()
    expect(result.failedCount).toBe(8)
    expect(result.failed).toHaveLength(5)
    expect(result.failed[0]).toEqual({ id: '0', name: 'App 0', description: 'Boot failed' })
    expect(result.runs).toEqual([])
    expect(orchestratorAutomationsClient.listActiveRuns).not.toHaveBeenCalled()
  })
})
