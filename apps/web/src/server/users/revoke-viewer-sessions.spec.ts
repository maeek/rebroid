import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest } from '@/server/orchestrator/request'
import { revokeUserViewerSessions, revokeViewerSessionsForUsers } from './revoke-viewer-sessions'

vi.mock('@/server/orchestrator/request', () => ({ jsonRequest: vi.fn() }))
const request = vi.mocked(jsonRequest)
const path = '/platform/display-sidecar/sessions/revoke'

describe('viewer revocation', () => {
  beforeEach(() => {
    request.mockReset()
  })

  it('sends owner IDs through the revocation command in bounded batches', async () => {
    const owners = Array.from({ length: 260 }, (_, index) => `owner-${index}`)
    const signal = AbortSignal.timeout(1000)
    await revokeViewerSessionsForUsers([...owners, owners[0]], signal)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(1, path, 'POST', { ownerUserIds: owners.slice(0, 256) }, { signal })
    expect(request).toHaveBeenNthCalledWith(2, path, 'POST', { ownerUserIds: owners.slice(256) }, { signal })
  })

  it('propagates failures so account changes can fail closed', async () => {
    request.mockRejectedValue(new Error('unavailable'))
    await expect(revokeUserViewerSessions('user')).rejects.toThrow('unavailable')
    expect(request).toHaveBeenCalledExactlyOnceWith(path, 'POST', { ownerUserIds: ['user'] }, { signal: undefined })
  })
})
