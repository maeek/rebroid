import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/activity/export/route'
import { getCurrentUser } from '@/server/auth/authorization'
import { exportAuditEvents } from '@/server/persistence/audit-repository'
import { recordAuditEvent } from './events'

vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/server/persistence/audit-repository', () => ({ exportAuditEvents: vi.fn() }))
vi.mock('./events', () => ({ recordAuditEvent: vi.fn() }))

const request = (query = '') => new NextRequest(`https://localhost/api/activity/export${query}`)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 'admin-1',
    role: 'admin',
    name: 'Operator',
    username: 'admin'
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  vi.mocked(exportAuditEvents).mockReturnValue([])
})

describe('audit CSV authorization and scope', () => {
  it('does not read or export events if current-session verification fails', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Authentication required'))
    await expect(GET(request())).rejects.toThrow('Authentication required')
    expect(exportAuditEvents).not.toHaveBeenCalled()
    expect(recordAuditEvent).not.toHaveBeenCalled()
  })

  it('denies non-administrators before touching the audit data', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>)
    expect((await GET(request('?resourceType=application&resourceId=app-1'))).status).toBe(403)
    expect(exportAuditEvents).not.toHaveBeenCalled()
    expect(recordAuditEvent).not.toHaveBeenCalled()
  })

  it('exports the exact app scope, filters, and sort without page limits', async () => {
    const response = await GET(
      request(
        '?resourceType=application&resourceId=app-1&search=start&actor=admin&outcome=failure&from=2026-11-08&sort=action:asc&page=9&pageSize=1'
      )
    )
    expect(exportAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'application',
        resourceId: 'app-1',
        search: 'start',
        actorUserId: 'admin',
        outcome: 'failure',
        from: '2026-11-08T00:00:00.000Z'
      }),
      { sorting: [{ id: 'action', desc: false }] }
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('attachment;')
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'audit.export',
        actorUserId: 'admin-1'
      })
    )
    expect(vi.mocked(recordAuditEvent).mock.calls[0]?.[0].details?.exported).toBe(0)
  })

  it('uses the same first-value query semantics as the page for duplicate parameters', async () => {
    const response = await GET(
      request('?resourceId=app-1&resourceId=other-app&from=2026-99-99&outcome=invalid&sort=unknown:desc')
    )
    expect(response.status).toBe(200)
    expect(exportAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'app-1', from: undefined, outcome: undefined }),
      { sorting: [{ id: 'createdAt', desc: true }] }
    )
  })
})
