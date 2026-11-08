import { beforeEach, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { request } from '@/server/orchestrator/request'
import { readDockerOperationLimits, saveDockerOperationLimits } from './docker-operation-settings'

vi.mock('@/server/auth/authorization', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/request', () => ({ request: vi.fn() }))
const limits = {
  maxConcurrentReads: 8,
  maxConcurrentLongOperations: 4,
  slowRequestWarningMs: 5000,
  longOperationTimeoutMs: 1_800_000
}
beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin', username: 'admin' } as Awaited<
    ReturnType<typeof requireAdmin>
  >)
  vi.mocked(request).mockResolvedValue(limits)
})

it('authorizes reads and updates before calling the backend', async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error('Forbidden'))
  await expect(readDockerOperationLimits()).rejects.toThrow('Forbidden')
  await expect(saveDockerOperationLimits(limits)).rejects.toThrow('Forbidden')
  expect(request).not.toHaveBeenCalled()
})

it('rejects invalid or additional fields without making a backend request', async () => {
  await expect(saveDockerOperationLimits({ ...limits, maxConcurrentReads: 0 })).rejects.toThrow('Enter valid')
  await expect(saveDockerOperationLimits({ ...limits, socketPath: '/other' })).rejects.toThrow('Enter valid')
  expect(request).not.toHaveBeenCalled()
  expect(recordAuditEvent).not.toHaveBeenCalled()
})

it('sends only the validated limits and audits successful changes', async () => {
  expect(await saveDockerOperationLimits(limits)).toEqual(limits)
  expect(request).toHaveBeenCalledWith(
    '/platform/docker/operation-limits',
    { method: 'PUT', body: JSON.stringify(limits) },
    expect.anything()
  )
  expect(recordAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({ actorUserId: 'admin', action: 'settings.docker_limits.update', details: limits })
  )
})

it('does not record a successful change after a failed update', async () => {
  vi.mocked(request).mockRejectedValue(new Error('Offline'))
  await expect(saveDockerOperationLimits(limits)).rejects.toThrow('Offline')
  expect(recordAuditEvent).not.toHaveBeenCalled()
})
