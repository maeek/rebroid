import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { loadApplicationActivity } from './application-activity-query'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/persistence/audit-repository', () => ({ listAuditEvents: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue(undefined as never)
  vi.mocked(getWebSettings).mockResolvedValue({ auditRetentionDays: 30 } as Awaited<ReturnType<typeof getWebSettings>>)
})
describe('application activity', () => {
  it('requires audit authorization before reading events', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
    await expect(loadApplicationActivity('app-1', {})).rejects.toThrow('Forbidden')
    expect(listAuditEvents).not.toHaveBeenCalled()
    expect(getWebSettings).not.toHaveBeenCalled()
  })
  it('pins the app scope despite conflicting URL filters and preserves pagination and sorting', async () => {
    const data = await loadApplicationActivity('app-1', {
      resourceId: 'other-app',
      resourceType: 'user',
      search: 'start',
      actor: 'admin',
      outcome: 'failure',
      from: '2026-11-08',
      page: '2',
      pageSize: '10',
      sort: 'action:asc'
    })
    expect(listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'app-1',
        resourceType: 'application',
        search: 'start'
      }),
      { page: 2, pageSize: 10, sorting: [{ id: 'action', desc: false }] }
    )
    expect(data.filters.resourceId).toBe('app-1')
    expect(data.filters).toMatchObject({ actor: 'admin', outcome: 'failure', from: '2026-11-08T00:00:00.000Z' })
  })
})
