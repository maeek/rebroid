import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { listAuditEvents, listAuditFacetValues } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { loadSecurityAuditLogPageData } from './page-data.server'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/persistence/audit-repository', () => ({ listAuditEvents: vi.fn(), listAuditFacetValues: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getWebSettings).mockResolvedValue({ auditRetentionDays: 30 } as Awaited<ReturnType<typeof getWebSettings>>)
})

describe('audit page reads', () => {
  it('checks administrator authorization before reading data or facets', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
    await expect(loadSecurityAuditLogPageData({})).rejects.toThrow('Forbidden')
    expect(listAuditEvents).not.toHaveBeenCalled()
    expect(listAuditFacetValues).not.toHaveBeenCalled()
    expect(getWebSettings).not.toHaveBeenCalled()
  })

  it('keeps ignored URL input out of controls, chips, and subsequent exports', async () => {
    const data = await loadSecurityAuditLogPageData({
      outcome: 'unknown',
      from: '2026-99-99',
      actor: ' admin ',
      search: ' start '
    })
    expect(data.filters).toMatchObject({ outcome: undefined, from: undefined, actor: 'admin', search: 'start' })
    expect(listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: undefined, from: undefined, actorUserId: 'admin', search: 'start' }),
      expect.any(Object)
    )
  })
})
