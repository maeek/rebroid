import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { setUserDisabledAction } from '@/server/users/actions/set-user-disabled-action'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { previewUsers } from './users-preview-data'
import { UsersSettings } from './users-settings'
import type { ActionResult } from '@/shared/actions/action-result'
import type { PublicUser } from '@/shared/contracts/auth-user'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/users/actions/set-user-disabled-action', () => ({ setUserDisabledAction: vi.fn() }))
vi.mock('@/server/users/actions/delete-user-action', () => ({ deleteUserAction: vi.fn() }))
vi.mock('./components/create-user-dialog', () => ({ CreateUserDialog: () => null }))
vi.mock('./components/password-policy-dialog', () => ({ PasswordPolicyDialog: () => null }))

const renderUsers = (users = previewUsers) =>
  render(
    <UsersSettings
      initialUsers={users}
      initialGroups={[]}
      initialPasswordMinimumLength={8}
    />
  )
const openActions = (name: string) => {
  const row = screen.getByRole('row', { name: new RegExp(name) })
  fireEvent.click(within(row).getByRole('button', { name: 'Open row actions' }))
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('Users account access actions', () => {
  it('shows a read-only status and lets users cancel an explicitly named disable action', async () => {
    renderUsers()
    fireEvent.click(screen.getByText('Active', { exact: true }))
    expect(screen.queryByRole('button', { name: 'Active' })).toBeNull()
    expect(setUserDisabledAction).not.toHaveBeenCalled()
    openActions('Ada Lovelace')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Disable user…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Ada Lovelace?' })
    expect(within(dialog).getByText(/signs users out and prevents new sign-ins/)).toBeVisible()
    expect(setUserDisabledAction).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(setUserDisabledAction).not.toHaveBeenCalled()
  })

  it('disables only after confirmation, shows pending feedback, and then offers Enable user', async () => {
    let finish!: (result: ActionResult<PublicUser>) => void
    vi.mocked(setUserDisabledAction).mockReturnValue(
      new Promise(resolve => {
        finish = resolve
      })
    )
    renderUsers()
    openActions('Ada Lovelace')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Disable user…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Ada Lovelace?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    expect(setUserDisabledAction).toHaveBeenCalledExactlyOnceWith('operator', true)
    expect(within(dialog).getByRole('button', { name: 'Disabling…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    act(() => {
      finish(actionOk({ ...previewUsers[0], disabled: true }))
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const row = screen.getByRole('row', { name: /Ada Lovelace/ })
    expect(within(row).getByText('Disabled', { exact: true })).toBeVisible()
    openActions('Ada Lovelace')
    expect(await screen.findByRole('menuitem', { name: 'Enable user' })).toBeVisible()
  })

  it('keeps the current status and confirmation after a rejected disable request', async () => {
    vi.mocked(setUserDisabledAction).mockResolvedValue(
      actionError({ message: 'Cannot remove or disable the last active admin.', code: 'conflict' })
    )
    renderUsers()
    openActions('Ada Lovelace')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Disable user…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Ada Lovelace?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger', description: 'Cannot remove or disable the last active admin.' })
      )
    )
    expect(dialog).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Disable user' })).toBeEnabled()
    expect(screen.getByText('Active', { exact: true })).toBeVisible()
  })

  it('enables an account through the explicitly named action', async () => {
    vi.mocked(setUserDisabledAction).mockResolvedValue(actionOk({ ...previewUsers[1], disabled: false }))
    renderUsers()
    openActions('Grace Hopper')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Enable user' }))
    await waitFor(() => expect(setUserDisabledAction).toHaveBeenCalledExactlyOnceWith('reviewer', false))
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /Grace Hopper/ })).getByText('Active', { exact: true })
      ).toBeVisible()
    )
  })

  it('confirms bulk disables and skips accounts that are already disabled', async () => {
    vi.mocked(setUserDisabledAction).mockResolvedValue(actionOk({ ...previewUsers[0], disabled: true }))
    renderUsers()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable selected' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Ada Lovelace?' })
    expect(setUserDisabledAction).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(setUserDisabledAction).toHaveBeenCalledExactlyOnceWith('operator', true)
    expect(screen.getByRole('button', { name: 'Disable selected' })).toBeDisabled()
  })

  it('retries only the failed users after a partially successful bulk disable', async () => {
    vi.mocked(setUserDisabledAction)
      .mockResolvedValueOnce(actionOk({ ...previewUsers[0], disabled: true }))
      .mockResolvedValueOnce(actionError({ message: 'Account is protected.', code: 'conflict' }))
      .mockResolvedValueOnce(actionOk({ ...previewUsers[1], disabled: true }))
    renderUsers(previewUsers.map(user => ({ ...user, disabled: false })))
    const adaRow = screen.getByRole('row', { name: /Ada Lovelace/ })
    const graceRow = screen.getByRole('row', { name: /Grace Hopper/ })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable selected' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable 2 users?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable users' }))
    await waitFor(() => expect(dialog).toHaveAccessibleName('Disable Grace Hopper?'))
    expect(within(adaRow).getByText('Disabled')).toBeVisible()
    expect(within(graceRow).getByText('Active')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(setUserDisabledAction).toHaveBeenCalledTimes(3)
    expect(setUserDisabledAction).toHaveBeenLastCalledWith('reviewer', true)
  })

  it('keeps the confirmation available after a connection failure', async () => {
    vi.mocked(setUserDisabledAction).mockRejectedValue(new Error('Connection unavailable'))
    renderUsers()
    openActions('Ada Lovelace')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Disable user…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Ada Lovelace?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger', description: 'Connection unavailable' })
      )
    )
    expect(within(dialog).getByRole('button', { name: 'Disable user' })).toBeEnabled()
    expect(screen.getByText('Active')).toBeVisible()
  })
})
