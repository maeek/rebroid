import { describe, expect, it, vi } from 'vitest'
import { orchestratorDiagnosticsClient as client } from '@/server/orchestrator/diagnostics/client'
import { revokeUserViewerSessions } from './revoke-viewer-sessions'
vi.mock('@/server/orchestrator/diagnostics/client', () => ({
  orchestratorDiagnosticsClient: { listDisplaySidecarSessions: vi.fn(), releaseDisplaySidecarSession: vi.fn() }
}))
describe('viewer revocation', () => {
  it('releases only sessions owned by the changed account', async () => {
    vi.mocked(client.listDisplaySidecarSessions).mockResolvedValue([
      { id: 'own', ownerUserId: 'user' },
      { id: 'foreign', ownerUserId: 'other' }
    ] as never)
    await revokeUserViewerSessions('user')
    expect(client.releaseDisplaySidecarSession).toHaveBeenCalledExactlyOnceWith('own', undefined)
  })
  it('propagates failures so account changes can fail closed', async () => {
    vi.mocked(client.listDisplaySidecarSessions).mockRejectedValue(new Error('unavailable'))
    await expect(revokeUserViewerSessions('user')).rejects.toThrow('unavailable')
  })
})
