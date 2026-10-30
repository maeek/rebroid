import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordPolicyDialog } from './password-policy-dialog'

const mocks = vi.hoisted(() => ({
  saveWebSettingsAction: vi.fn(),
  toast: vi.fn()
}))

vi.mock('@/server/web-settings/actions/save-web-settings-action', () => ({
  saveWebSettingsAction: mocks.saveWebSettingsAction
}))

vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))

describe('PasswordPolicyDialog', () => {
  beforeEach(() => {
    mocks.saveWebSettingsAction.mockReset()
    mocks.toast.mockReset()
  })

  it('keeps policy controls out of the page until the dialog is opened', () => {
    render(<PasswordPolicyDialog initialPasswordMinimumLength={8} />)

    expect(screen.queryByLabelText('Minimum password length')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Password policy' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum password length')).toHaveValue(8)
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()
  })

  it('shows pending feedback and closes after saving', async () => {
    let resolveSave:
      ((value: { ok: true; data: { passwordMinimumLength: number }; requestId: string }) => void) | undefined
    mocks.saveWebSettingsAction.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveSave = resolve
        })
    )
    render(<PasswordPolicyDialog initialPasswordMinimumLength={8} />)

    fireEvent.click(screen.getByRole('button', { name: 'Password policy' }))
    fireEvent.change(screen.getByLabelText('Minimum password length'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }))

    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveAttribute('aria-busy', 'true')
    expect(mocks.saveWebSettingsAction).toHaveBeenCalledWith({ passwordMinimumLength: 12 })

    resolveSave?.({ ok: true, data: { passwordMinimumLength: 12 }, requestId: 'request-1' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Password policy saved', variant: 'success' })
  })
})
