import { after } from 'next/server'
import { afterEach, expect, it, vi } from 'vitest'
import { appendAuditEvent, pruneAuditEventsOlderThan } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { recordAuditEvent } from './events'

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/server/persistence/audit-repository', () => ({
  appendAuditEvent: vi.fn(),
  pruneAuditEventsOlderThan: vi.fn()
}))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))
vi.mock('@/server/observability/logger', () => ({ logger: { error: vi.fn() } }))

afterEach(() => vi.useRealTimers())

it('writes every event, shares the retention check, and retries a failed prune on the next write', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const record = async () => {
    recordAuditEvent({ category: 'application', action: 'start', details: { token: 'private' } })
    const task = vi.mocked(after).mock.lastCall?.[0]
    if (typeof task !== 'function') throw new Error('Expected a deferred audit write')
    await task()
  }
  const settings = Promise.withResolvers<Awaited<ReturnType<typeof getWebSettings>>>()
  vi.mocked(getWebSettings).mockReturnValue(settings.promise)
  const first = record()
  await record()
  expect(getWebSettings).toHaveBeenCalledTimes(1)
  settings.resolve({ auditRetentionDays: 30 } as Awaited<ReturnType<typeof getWebSettings>>)
  await first
  await record()
  expect(pruneAuditEventsOlderThan).toHaveBeenCalledExactlyOnceWith(30)

  vi.setSystemTime(new Date('2026-01-01T01:00:00Z'))
  vi.mocked(pruneAuditEventsOlderThan).mockImplementationOnce(() => {
    throw new Error('Database busy')
  })
  await record()
  await record()
  expect(pruneAuditEventsOlderThan).toHaveBeenCalledTimes(3)
  expect(appendAuditEvent).toHaveBeenCalledTimes(5)
  expect(appendAuditEvent).toHaveBeenLastCalledWith(expect.objectContaining({ details: { token: '[redacted]' } }))
})
