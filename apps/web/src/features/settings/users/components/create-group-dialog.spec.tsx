import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultUserPermissions,
  defaultUserQuota,
  fullPermissions,
  unlimitedQuota
} from '@/shared/permissions/permissions'
import { buildCreateGroupInput, CreateGroupDialog, createInitialGroupDraft } from './create-group-dialog'
import type { UserGroup } from '@/shared/contracts/auth-user'

const mocks = vi.hoisted(() => ({
  createUserGroupAction: vi.fn(),
  toast: vi.fn()
}))

vi.mock('@/server/users/actions/create-user-group-action', () => ({
  createUserGroupAction: mocks.createUserGroupAction
}))

vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
vi.mock('@/shared/model/settings/use-resource-limit-bounds', () => ({
  useResourceLimitBounds: () => null
}))

const createdGroup: UserGroup = {
  id: 'group-1',
  name: 'Support',
  description: 'Support operators',
  role: 'user',
  permissions: defaultUserPermissions,
  quotas: defaultUserQuota,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z'
}

const openAndCompleteDetails = () => {
  fireEvent.click(screen.getByRole('button', { name: 'New group' }))
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Support' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Support operators' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

describe('CreateGroupDialog', () => {
  beforeEach(() => {
    mocks.createUserGroupAction.mockReset()
    mocks.toast.mockReset()
  })

  it('uses user defaults and locks admin payloads to full access', () => {
    expect(buildCreateGroupInput(createInitialGroupDraft())).toEqual({
      name: '',
      description: '',
      role: 'user',
      quotas: defaultUserQuota,
      permissions: defaultUserPermissions
    })

    expect(
      buildCreateGroupInput({
        ...createInitialGroupDraft(),
        role: 'admin',
        quotas: { maxOpenApps: 1 },
        permissions: { 'applications:create': false }
      })
    ).toEqual({
      name: '',
      description: '',
      role: 'admin',
      quotas: unlimitedQuota,
      permissions: fullPermissions
    })
  })

  it('preserves drafts across steps, submits once, shows pending feedback, and resets after success', async () => {
    let resolveCreate: ((value: { ok: true; data: UserGroup; requestId: string }) => void) | undefined
    mocks.createUserGroupAction.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveCreate = resolve
        })
    )
    const onCreated = vi.fn()
    render(<CreateGroupDialog onCreated={onCreated} />)

    openAndCompleteDetails()
    expect(screen.getByText('Max Open Apps')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByDisplayValue('Support')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))

    expect(screen.getByRole('button', { name: 'Creating…' })).toHaveAttribute('aria-busy', 'true')
    expect(mocks.createUserGroupAction).toHaveBeenCalledWith({
      name: 'Support',
      description: 'Support operators',
      role: 'user',
      quotas: defaultUserQuota,
      permissions: defaultUserPermissions
    })

    resolveCreate?.({ ok: true, data: createdGroup, requestId: 'request-1' })
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdGroup))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'New group' }))
    expect(screen.getByLabelText(/Name/)).toHaveValue('')
    expect(screen.getByTestId('group-step-1')).toHaveAttribute('aria-current', 'step')
  })

  it('keeps the draft and final step visible after an error', async () => {
    mocks.createUserGroupAction.mockResolvedValue({
      ok: false,
      requestId: 'request-2',
      error: {
        message: 'Group already exists.',
        code: 'conflict',
        requestId: 'request-2'
      }
    })
    render(<CreateGroupDialog onCreated={vi.fn()} />)

    openAndCompleteDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('group-step-3')).toHaveAttribute('aria-current', 'step')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByDisplayValue('Support')).toBeTruthy()
  })
})
