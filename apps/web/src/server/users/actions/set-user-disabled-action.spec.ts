import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { mutateUsersFile } from '@/server/auth/user-store'
import { runDueWebMaintenance } from '@/server/maintenance/web-maintenance'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { setUserDisabledAction } from './set-user-disabled-action'
import { updateUserGroupAction } from './update-user-group-action'
import type { DisplaySidecarSession } from '@/shared/contracts/diagnostics'

vi.mock('../shared', () => ({ requireAdminUser: () => Promise.resolve({ id: 'admin' }), revalidateUsersPage: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/client', () => ({
  orchestratorDiagnosticsClient: { listDisplaySidecarSessions: vi.fn(), releaseDisplaySidecarSession: vi.fn() }
}))

const list = vi.mocked(orchestratorDiagnosticsClient.listDisplaySidecarSessions)
const release = vi.mocked(orchestratorDiagnosticsClient.releaseDisplaySidecarSession)

describe('account access revocation', () => {
  let directory: string
  let userId: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-web-revocation-'))
    vi.stubEnv('WEB_DATABASE_PATH', join(directory, 'state.sqlite'))
    vi.stubEnv('INITIAL_ADMIN_PASSWORD', 'initial-admin-password')
    const user = await userService.createUser({ username: 'tester', password: 'original-password' })
    userId = user.id
  })

  afterEach(async () => {
    resetDatabaseForTests()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('revokes sessions on both sides of the state change', async () => {
    const observed: boolean[] = []
    list.mockImplementation(async () => {
      observed.push((await userService.getUserById(userId))!.disabled)
      return []
    })
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: true, data: { disabled: true } })
    expect(observed).toEqual([false, true])
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('fails closed before the write when the first revocation fails', async () => {
    list.mockRejectedValue(new Error('unavailable'))
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: false })
    expect((await userService.getUserById(userId))?.disabled).toBe(false)
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('returns committed state and resumes post-commit revocation after reopening SQLite', async () => {
    list.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('unavailable'))
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: true, data: { disabled: true } })
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ details: { viewerRevocation: 'pending' } }))
    expect(hasPendingViewerRevocation(userId)).toBe(true)

    resetDatabaseForTests()
    list.mockResolvedValue([{ id: 'stale-session', ownerUserId: userId }] as DisplaySidecarSession[])
    await runDueWebMaintenance(Date.now() + 60_000)
    expect(release).toHaveBeenCalledExactlyOnceWith('stale-session', expect.any(AbortSignal))
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('fetches one inventory in each group revocation pass regardless of member count', async () => {
    const group = await userService.createGroup({ name: 'Viewer group' })
    await userService.updateUser(userId, { groupIds: [group.id] })
    const other = await userService.createUser({
      username: 'second',
      password: 'original-password',
      groupIds: [group.id]
    })
    list
      .mockResolvedValueOnce([{ id: 'first-session', ownerUserId: userId }] as DisplaySidecarSession[])
      .mockResolvedValueOnce([
        { id: 'second-session', ownerUserId: other.id },
        { id: 'unrelated-session', ownerUserId: 'admin' }
      ] as DisplaySidecarSession[])

    await expect(updateUserGroupAction(group.id, { name: 'Updated' })).resolves.toMatchObject({ ok: true })
    expect(list).toHaveBeenCalledTimes(2)
    expect(release.mock.calls.map(([id]) => id)).toEqual(['first-session', 'second-session'])
  })

  it('resolves group members after earlier account mutations have committed', async () => {
    const group = await userService.createGroup({ name: 'Viewer group' })
    const started = Promise.withResolvers<void>()
    const proceed = Promise.withResolvers<void>()
    const enrollment = mutateUsersFile(async file => {
      started.resolve()
      await proceed.promise
      const account = file.users.find(user => user.id === userId)!
      account.groupIds.push(group.id)
    })
    await started.promise
    list
      .mockResolvedValueOnce([{ id: 'existing-session', ownerUserId: userId }] as DisplaySidecarSession[])
      .mockResolvedValueOnce([])
    const edit = updateUserGroupAction(group.id, { name: 'Updated' })
    proceed.resolve()
    await enrollment
    await expect(edit).resolves.toMatchObject({ ok: true })
    expect(list).toHaveBeenCalledTimes(2)
    expect(release).toHaveBeenCalledExactlyOnceWith('existing-session', expect.any(AbortSignal))
  })
})
