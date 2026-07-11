import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beginLoginAction } from '@/server/users/actions/begin-login-action'
import LoginCard from './login-card'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() })
}))

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }))
vi.mock('@/server/users/actions/begin-login-action', () => ({ beginLoginAction: vi.fn() }))

const successfulAction = (mfaRequired: boolean) => ({
  ok: true as const,
  data: { mfaRequired },
  requestId: 'request-1'
})

describe('login card', () => {
  beforeEach(() => {
    vi.mocked(signIn).mockResolvedValue({ ok: true, error: null, status: 200, url: null })
  })

  it('does not show the MFA field before primary credentials are verified', () => {
    render(<LoginCard />)

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Authentication or recovery code/)).not.toBeInTheDocument()
  })

  it('moves to the MFA screen only after valid credentials for an MFA-enabled account', async () => {
    vi.mocked(beginLoginAction).mockResolvedValue(successfulAction(true))
    render(<LoginCard />)

    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('heading', { name: 'Two-factor authentication' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Authentication or recovery code/)).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signs in directly after valid credentials when MFA is disabled', async () => {
    vi.mocked(beginLoginAction).mockResolvedValue(successfulAction(false))
    render(<LoginCard />)

    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('credentials', {
        username: 'admin',
        password: 'correct-password',
        mfaCode: undefined,
        redirect: false
      })
    )
  })
})
