import { describe, expect, it, vi } from 'vitest'
import { userService } from '@/server/auth/user'
import { orchestratorDiagnosticsClient as client } from '@/server/orchestrator/diagnostics/client'
import { revokeGroupViewerSessions, revokeUserViewerSessions } from './revoke-viewer-sessions'
vi.mock('@/server/orchestrator/diagnostics/client', () => ({
  orchestratorDiagnosticsClient: { listDisplaySidecarSessions: vi.fn(), releaseDisplaySidecarSession: vi.fn() }
}))
vi.mock('@/server/auth/user', () => ({ userService: { listUsers: vi.fn() } }))
describe('viewer revocation', () => {
  it('releases only sessions owned by the changed account', async () => {
    vi.mocked(client.listDisplaySidecarSessions).mockResolvedValue([
      { id: 'own', ownerUserId: 'user' },
      { id: 'foreign', ownerUserId: 'other' }
    ] as never)
    await revokeUserViewerSessions('user')
    expect(client.releaseDisplaySidecarSession).toHaveBeenCalledExactlyOnceWith('own')
  })
  it('propagates failures so account changes can fail closed', async () => {
    vi.mocked(client.listDisplaySidecarSessions).mockRejectedValue(new Error('unavailable'))
    await expect(revokeUserViewerSessions('user')).rejects.toThrow('unavailable')
  })
})

it('revokes viewer tokens for affected group members only', async () => {
  vi.mocked(userService.listUsers).mockResolvedValue([
    { id: 'member', groupIds: ['changed'] },
    { id: 'other', groupIds: ['unchanged'] }
  ] as never)
  vi.mocked(client.listDisplaySidecarSessions).mockResolvedValue([
    { id: 'revoke', ownerUserId: 'member' },
    { id: 'keep', ownerUserId: 'other' }
  ] as never)
  await revokeGroupViewerSessions('changed')
  expect(client.releaseDisplaySidecarSession).toHaveBeenCalledExactlyOnceWith('revoke')
})
