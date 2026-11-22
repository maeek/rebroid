import { beforeEach, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorScheduledTasksClient } from '@/server/orchestrator/scheduled-tasks/client'
import { loadPlatformSchedulerPageData } from './page-data.server'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/orchestrator/scheduled-tasks/client', () => ({
  orchestratorScheduledTasksClient: { list: vi.fn(), listActions: vi.fn() }
}))

beforeEach(() => vi.resetAllMocks())

it('propagates authorization redirects before querying maintenance tasks', async () => {
  const redirect = new Error('redirect to applications')
  vi.mocked(requireAdmin).mockRejectedValue(redirect)
  await expect(loadPlatformSchedulerPageData()).rejects.toBe(redirect)
  expect(requireAdmin).toHaveBeenCalledTimes(1)
  expect(orchestratorScheduledTasksClient.list).not.toHaveBeenCalled()
  expect(orchestratorScheduledTasksClient.listActions).not.toHaveBeenCalled()
})

it('returns a support reference when either scheduler query fails', async () => {
  vi.mocked(orchestratorScheduledTasksClient.list).mockResolvedValue([])
  vi.mocked(orchestratorScheduledTasksClient.listActions).mockRejectedValue(new Error('internal endpoint details'))
  const result = await loadPlatformSchedulerPageData()
  expect(result).toMatchObject({ ok: false, error: { code: 'internal' } })
  expect(result.requestId).toBeTruthy()
  expect(JSON.stringify(result)).not.toContain('internal endpoint details')
})
