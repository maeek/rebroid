import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from '@/server/auth/authorization'
import { purgeAuditEvents } from '@/server/persistence/audit-repository'
import { saveWebSettings } from '@/server/web-settings/store'
import { purgeAllAuditEventsAction, saveAuditRetentionAction } from './actions'
import { recordAuditEvent } from './events'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/persistence/audit-repository', () => ({ purgeAuditEvents: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ saveWebSettings: vi.fn() }))
vi.mock('./events', () => ({ recordAuditEvent: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin', username: 'admin', name: 'Operator' } as Awaited<
    ReturnType<typeof requireAdmin>
  >)
})

describe('audit maintenance boundaries', () => {
  it('denies mutations before reading or writing settings and audit data', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
    await expect(purgeAllAuditEventsAction()).rejects.toThrow('Forbidden')
    await expect(saveAuditRetentionAction(30)).rejects.toThrow('Forbidden')
    expect(purgeAuditEvents).not.toHaveBeenCalled()
    expect(saveWebSettings).not.toHaveBeenCalled()
    expect(recordAuditEvent).not.toHaveBeenCalled()
  })

  it.each([0, -1, 3651, NaN, Infinity, 1.5])(
    'rejects invalid retention instead of silently restoring defaults: %s',
    async value => {
      await expect(saveAuditRetentionAction(value)).rejects.toThrow('Retention must be a whole number')
      expect(saveWebSettings).not.toHaveBeenCalled()
      expect(recordAuditEvent).not.toHaveBeenCalled()
    }
  )

  it('records the completed purge under the verified administrator', async () => {
    vi.mocked(purgeAuditEvents).mockReturnValue(12)
    expect(await purgeAllAuditEventsAction()).toEqual({ purged: 12 })
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin',
        actorLabel: 'Operator',
        action: 'audit.purge',
        details: { purged: 12 }
      })
    )
  })
})
