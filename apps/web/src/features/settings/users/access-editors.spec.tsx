import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { GroupEditPage } from './group-edit-page'
import { UserEditPage } from './user-edit-page'
import { previewUsers } from './users-preview-data'
import type { UserGroup } from '@/shared/contracts/auth-user'

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  updateGroup: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  preparePhoto: vi.fn()
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/server/users/actions/update-user-action', () => ({ updateUserAction: mocks.updateUser }))
vi.mock('@/server/users/actions/update-user-group-action', () => ({ updateUserGroupAction: mocks.updateGroup }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
vi.mock('@/shared/model/settings/use-resource-limit-bounds', () => ({ useResourceLimitBounds: () => null }))
vi.mock('@/shared/model/media/icon-metadata', () => ({ optimizeIconFile: mocks.preparePhoto }))
const groups: UserGroup[] = [
  {
    id: 'operators',
    name: 'Operators',
    description: 'Operate apps',
    role: 'user',
    permissions: { 'applications:create': true },
    quotas: defaultUserQuota,
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'auditors',
    name: 'Auditors',
    description: 'Audit apps',
    role: 'user',
    permissions: { 'applications:create': false },
    quotas: defaultUserQuota,
    createdAt: '',
    updatedAt: ''
  }
]
const user = {
  ...previewUsers[0],
  groupIds: ['operators', 'auditors'],
  permissionOverrides: { 'applications:delete': false }
}
const selectOption = async (name: RegExp, option: string) => {
  const trigger = screen.getByRole('combobox', { name })
  fireEvent.click(trigger)
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.click(item)
  await waitFor(() => expect(trigger).toHaveTextContent(option))
}

describe('access editors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['replace', 'remove'])('stages photo %s until Save User is pressed', async change => {
    const original = 'data:image/webp;base64,original'
    const replacement = 'data:image/webp;base64,replacement'
    mocks.preparePhoto.mockResolvedValue(replacement)
    mocks.updateUser.mockResolvedValue({ ok: true, data: user, requestId: 'saved' })
    render(
      <UserEditPage
        user={{ ...user, avatarDataUrl: original }}
        groups={groups}
      />
    )
    if (change === 'replace') {
      fireEvent.change(screen.getByLabelText('Profile photo'), {
        target: { files: [new File(['photo'], 'replacement.png', { type: 'image/png' })] }
      })
      await waitFor(() => expect(screen.getByText('replacement.png')).toBeVisible())
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
      expect(screen.getByText('Using initials')).toBeVisible()
    }
    expect(mocks.updateUser).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith(
      user.id,
      expect.objectContaining({ avatarDataUrl: change === 'replace' ? replacement : null })
    )
  })

  it('previews ordered group changes and saves the same order without changing unrelated overrides', async () => {
    mocks.updateUser.mockResolvedValue({ ok: true, data: user, requestId: 'saved' })
    render(
      <UserEditPage
        user={user}
        groups={groups}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Permissions & quotas' }))
    const permission = screen
      .getAllByRole('row')
      .find(item => within(item).queryByText('Create applications', { exact: true }))!
    expect(within(permission).getByText('Not granted', { exact: true })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: 'Groups' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Auditors earlier' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Permissions & quotas' }))
    expect(within(permission).getByText('Granted', { exact: true })).toBeVisible()
    expect(within(permission).getByText('From Operators')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.updateUser).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        groupIds: ['auditors', 'operators'],
        permissionOverrides: { 'applications:delete': false },
        password: undefined
      })
    )
  })

  it('locks effective admin access and retains overrides when switching back to User', async () => {
    render(
      <UserEditPage
        user={user}
        groups={groups}
      />
    )
    await selectOption(/^Role/, 'Admin')
    fireEvent.click(screen.getByRole('tab', { name: 'Permissions & quotas' }))
    expect(screen.getByText('Full administrator access')).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Override Delete applications' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }))
    await selectOption(/^Role/, 'User')
    fireEvent.click(screen.getByRole('tab', { name: 'Permissions & quotas' }))
    expect(screen.getByRole('combobox', { name: 'Override Delete applications' })).toHaveTextContent('Deny')
  })

  it('retains edited group permissions after save failure and blocks duplicate saves while pending', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.updateGroup.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done
        })
    )
    render(<GroupEditPage group={groups[0]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Permissions & quotas' }))
    expect(screen.getByRole('spinbutton', { name: 'Max Open Apps' })).toBeVisible()
    await selectOption(/^Set Start applications$/, 'Grant')
    fireEvent.click(screen.getByRole('button', { name: 'Save Group' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Set Start applications' })).toBeDisabled()
    expect(mocks.updateGroup).toHaveBeenCalledTimes(1)
    expect(mocks.updateGroup).toHaveBeenCalledWith(
      groups[0].id,
      expect.objectContaining({ permissions: { 'applications:create': true, 'applications:start': true } })
    )
    resolve({
      ok: false,
      requestId: 'failed',
      error: { code: 'conflict', message: 'Could not save', requestId: 'failed' }
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Group' })).toBeEnabled())
    expect(screen.getByRole('combobox', { name: 'Set Start applications' })).toHaveTextContent('Grant')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
