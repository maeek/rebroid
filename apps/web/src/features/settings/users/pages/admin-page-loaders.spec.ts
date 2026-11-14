import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getServerAuthSession } from '@/server/auth/auth'
import { userService } from '@/server/auth/user'
import { getWebSettings } from '@/server/web-settings/store'
import { unlimitedQuota } from '@/shared/permissions/permissions'
import { getGroupDetailPageData } from './group-detail/page-data.server'
import { getGroupsListPageData } from './groups-list/page-data.server'
import { getUsersListPageData } from './users-list/page-data.server'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

vi.mock('@/server/auth/account-sessions', () => ({ isCurrentAccountSession: vi.fn() }))
vi.mock('@/server/auth/auth', () => ({ getServerAuthSession: vi.fn() }))
vi.mock('@/server/auth/user', () => ({
  userService: { getUserById: vi.fn(), listGroups: vi.fn(), listUsers: vi.fn() }
}))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))

const timestamp = '2026-01-01T00:00:00Z'
const account: PublicUser = {
  id: 'account-1',
  username: 'viewer',
  name: 'Viewer',
  isPlatformAdmin: false,
  groupIds: [],
  disabled: false,
  passwordChangeRequired: false,
  mfaEnabled: false,
  sessionVersion: 1,
  avatarDataUrl: null,
  accentColor: 'blue',
  effectivePermissions: {},
  effectiveQuotas: unlimitedQuota,
  createdAt: timestamp,
  updatedAt: timestamp
}
const session = {
  user: { id: account.id, sessionVersion: account.sessionVersion, sessionId: 'session-1', authEpoch: 'epoch-1' },
  expires: '2099-01-01T00:00:00Z'
}
const group: UserGroup = {
  id: 'group-1',
  name: 'Private group',
  description: '',
  permissions: {},
  quotas: unlimitedQuota,
  createdAt: timestamp,
  updatedAt: timestamp
}
const protectedAccount = { ...account, id: 'account-2', username: 'private-account' }

const loaders = [
  ['users list', getUsersListPageData, { users: [protectedAccount], groups: [group], passwordMinimumLength: 12 }],
  ['groups list', getGroupsListPageData, { groups: [group] }],
  ['group detail', () => getGroupDetailPageData(group.id), { group }]
] as const

describe.each(loaders)('administrative %s loader', (_name, load, expected) => {
  beforeEach(() => {
    vi.mocked(getServerAuthSession).mockResolvedValue(session)
    vi.mocked(isCurrentAccountSession).mockReturnValue(true)
    vi.mocked(userService.getUserById).mockResolvedValue(account)
    vi.mocked(userService.listUsers).mockResolvedValue([protectedAccount])
    vi.mocked(userService.listGroups).mockResolvedValue([group])
    vi.mocked(getWebSettings).mockResolvedValue({
      passwordMinimumLength: 12
    } as Awaited<ReturnType<typeof getWebSettings>>)
  })

  it.each([
    ['a caller without a session', null, '/login'],
    ['a non-administrator', session, '/apps']
  ] as const)('redirects %s before reading protected data', async (_caller, callerSession, path) => {
    vi.mocked(getServerAuthSession).mockResolvedValue(callerSession)

    await expect(load()).rejects.toHaveProperty('digest', expect.stringContaining(`;${path};`))
    expect(userService.listUsers).not.toHaveBeenCalled()
    expect(userService.listGroups).not.toHaveBeenCalled()
    expect(getWebSettings).not.toHaveBeenCalled()
  })

  it('returns page data to a current administrator', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ ...account, isPlatformAdmin: true })

    await expect(load()).resolves.toEqual(expected)
  })
})
