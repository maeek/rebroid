import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/server/audit/events'
import { createTestSessionIdentity } from '@/server/auth/test-administrator'
import { userService } from '@/server/auth/user'
import { mutateUsersFile } from '@/server/auth/user-store'
import { runDueWebMaintenance } from '@/server/maintenance/web-maintenance'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeViewerSessionsForUsers } from '@/server/users/revoke-viewer-sessions'
import { requireAdminUser } from '../shared'
import { createUserAction } from './create-user-action'
import { setUserDisabledAction } from './set-user-disabled-action'
import { updateUserAction } from './update-user-action'
import { updateUserGroupAction } from './update-user-group-action'

vi.mock('../shared', () => ({ requireAdminUser: vi.fn(), revalidateUsersPage: vi.fn() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/users/revoke-viewer-sessions', () => ({ revokeViewerSessionsForUsers: vi.fn() }))

const revoke = vi.mocked(revokeViewerSessionsForUsers)
const currentAdmin = async (id = 'admin') => {
  const user = await userService.getUserById(id)
  if (!user?.isPlatformAdmin || user.disabled || user.passwordChangeRequired) throw new Error('Access denied')
  return { ...user, identity: createTestSessionIdentity(user) }
}

const administrator = async () => ({ identity: (await currentAdmin()).identity, requestId: 'test-request' })

describe('account access revocation', () => {
  let directory: string
  let userId: string

  beforeEach(async () => {
    vi.resetAllMocks()
    directory = await mkdtemp(join(tmpdir(), 'rebroid-web-revocation-'))
    vi.stubEnv('WEB_DATABASE_PATH', join(directory, 'state.sqlite'))
    vi.stubEnv('INITIAL_ADMIN_PASSWORD', 'initial-admin-password')
    await userService.completeRequiredPasswordChange('admin', 'initial-admin-password', 'replacement-password')
    vi.mocked(requireAdminUser).mockImplementation(() => currentAdmin())
    revoke.mockResolvedValue(undefined)
    const user = await userService.createUser(
      { username: 'tester', password: 'original-password' },
      await administrator()
    )
    userId = user.id
  })

  afterEach(async () => {
    resetDatabaseForTests()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('revokes sessions on both sides of the state change', async () => {
    const observed: boolean[] = []
    revoke.mockImplementation(async () => {
      observed.push((await userService.getUserById(userId))!.disabled)
    })
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: true, data: { disabled: true } })
    expect(observed).toEqual([false, true])
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('fails closed before the write when the first revocation fails', async () => {
    revoke.mockRejectedValue(new Error('unavailable'))
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: false })
    expect((await userService.getUserById(userId))?.disabled).toBe(false)
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('returns committed state and resumes post-commit revocation after reopening SQLite', async () => {
    revoke.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('unavailable'))
    await expect(setUserDisabledAction(userId, true)).resolves.toMatchObject({ ok: true, data: { disabled: true } })
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ details: { viewerRevocation: 'pending' } }))
    expect(hasPendingViewerRevocation(userId)).toBe(true)

    resetDatabaseForTests()
    revoke.mockResolvedValue(undefined)
    await runDueWebMaintenance(Date.now() + 60_000)
    expect(revoke).toHaveBeenCalledTimes(3)
    expect(revoke).toHaveBeenLastCalledWith([userId], expect.any(AbortSignal))
    expect(hasPendingViewerRevocation(userId)).toBe(false)
  })

  it('sends the affected owners together in each group revocation pass', async () => {
    const group = await userService.createGroup({ name: 'Viewer group' }, await administrator())
    await userService.updateUser(userId, { groupIds: [group.id] }, await administrator())
    revoke.mockClear()
    const other = await userService.createUser(
      {
        username: 'second',
        password: 'original-password',
        groupIds: [group.id]
      },
      await administrator()
    )
    await expect(updateUserGroupAction(group.id, { name: 'Updated' })).resolves.toMatchObject({ ok: true })
    expect(revoke).toHaveBeenCalledTimes(2)
    for (const [owners] of revoke.mock.calls) expect(owners).toEqual(expect.arrayContaining([userId, other.id]))
  })

  it('resolves group members after earlier account mutations have committed', async () => {
    const group = await userService.createGroup({ name: 'Viewer group' }, await administrator())
    const started = Promise.withResolvers<void>()
    const proceed = Promise.withResolvers<void>()
    const enrollment = mutateUsersFile(async file => {
      started.resolve()
      await proceed.promise
      const account = file.users.find(user => user.id === userId)!
      account.groupIds.push(group.id)
    })
    await started.promise
    const edit = updateUserGroupAction(group.id, { name: 'Updated' })
    proceed.resolve()
    await enrollment
    await expect(edit).resolves.toMatchObject({ ok: true })
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenLastCalledWith([userId], expect.any(AbortSignal))
  })

  it('validates a rejected last-administrator change before revoking viewers', async () => {
    await expect(updateUserAction('admin', { groupIds: [] })).resolves.toMatchObject({
      ok: false,
      error: { code: 'conflict' }
    })
    expect(revoke).not.toHaveBeenCalled()
    expect(hasPendingViewerRevocation('admin')).toBe(false)
  })

  it('rejects an already authenticated actor demoted while their command is queued', async () => {
    const actor = await userService.createUser(
      {
        username: 'departing-admin',
        password: 'original-password',
        groupIds: ['admins']
      },
      await administrator()
    )
    await userService.completeRequiredPasswordChange(actor.id, 'original-password', 'replacement-password')
    const entered = Promise.withResolvers<void>()
    const proceed = Promise.withResolvers<void>()
    revoke.mockImplementationOnce(async () => {
      entered.resolve()
      await proceed.promise
    })
    const demotion = updateUserAction(actor.id, { groupIds: ['users'] })
    await entered.promise
    const authenticated = Promise.withResolvers<void>()
    vi.mocked(requireAdminUser).mockImplementationOnce(async () => {
      const admin = await currentAdmin(actor.id)
      authenticated.resolve()
      return admin
    })
    const creation = createUserAction({ username: 'new-admin', password: 'original-password', groupIds: ['admins'] })
    try {
      await authenticated.promise
    } finally {
      proceed.resolve()
    }

    await expect(demotion).resolves.toMatchObject({ ok: true, data: { isPlatformAdmin: false } })
    await expect(creation).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect((await userService.listUsers()).some(user => user.username === 'new-admin')).toBe(false)
  })
})
