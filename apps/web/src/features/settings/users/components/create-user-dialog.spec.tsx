import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createUserAction } from '@/server/users/actions/create-user-action'
import { actionOk } from '@/shared/actions/action-result'
import { defaultUserGroupId } from '@/shared/permissions/effective-access'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { previewUsers } from '../users-preview-data'
import { CreateUserDialog } from './create-user-dialog'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/server/users/actions/create-user-action', () => ({ createUserAction: vi.fn() }))

it('generates a masked temporary password that meets the policy and submits the latest value', async () => {
  const user = previewUsers[0]
  vi.mocked(createUserAction).mockResolvedValue(actionOk(user))
  const onCreated = vi.fn()
  render(
    <CreateUserDialog
      groups={[
        {
          id: defaultUserGroupId,
          name: 'Users',
          description: '',
          permissions: {},
          quotas: defaultUserQuota,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      ]}
      onCreated={onCreated}
      passwordMinimumLength={128}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: 'New user' }))
  fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: user.username } })
  const password = screen.getByLabelText<HTMLInputElement>(/Temporary Password/)
  const generate = screen.getByRole('button', { name: 'Generate password' })
  const copy = screen.getByRole('button', { name: 'Copy temporary password' })
  expect(password).toHaveAttribute('type', 'password')
  expect(password).toHaveAccessibleDescription(/new password on first login/)
  expect(screen.getByText('Change required')).toBeInstanceOf(HTMLSpanElement)
  expect(copy).toBeDisabled()
  fireEvent.click(generate)
  const firstPassword = password.value
  expect(firstPassword).toMatch(/^[A-Za-z0-9_-]{128}$/)
  expect(copy).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Show temporary password' }))
  expect(password).toHaveAttribute('type', 'text')
  expect(password).toHaveValue(firstPassword)
  fireEvent.click(screen.getByRole('button', { name: 'Hide temporary password' }))
  expect(password).toHaveAttribute('type', 'password')
  expect(password).toHaveValue(firstPassword)

  fireEvent.click(generate)
  const latestPassword = password.value
  expect(latestPassword).not.toBe(firstPassword)
  expect(createUserAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Create User' }))

  expect(createUserAction).toHaveBeenCalledExactlyOnceWith({
    username: user.username,
    password: latestPassword,
    groupIds: [defaultUserGroupId]
  })
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(user))
})
