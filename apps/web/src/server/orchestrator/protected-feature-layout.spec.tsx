import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedLayout from '@/app/(protected)/layout'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { requiredPasswordChangePath } from '@/server/auth/password-change-routing'
import { loadFeatureFlags } from './features'
import type { PublicUser } from '@/shared/contracts/auth-user'

vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/server', () => ({ connection: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ getAuthenticatedUser: vi.fn() }))
vi.mock('./features', () => ({ loadFeatureFlags: vi.fn() }))

describe('protected layout feature reads', () => {
  beforeEach(() => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ passwordChangeRequired: false } as PublicUser)
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-pathname': '/apps' }))
    vi.mocked(redirect).mockImplementation(path => {
      throw new Error(path)
    })
  })

  it('waits for the request and authentication before reading features', async () => {
    const request = Promise.withResolvers<void>()
    const authentication = Promise.withResolvers<PublicUser>()
    vi.mocked(connection).mockReturnValue(request.promise)
    vi.mocked(getAuthenticatedUser).mockReturnValue(authentication.promise)
    const render = ProtectedLayout({ children: null })

    expect(loadFeatureFlags).not.toHaveBeenCalled()
    request.resolve()
    await request.promise
    expect(loadFeatureFlags).not.toHaveBeenCalled()

    authentication.resolve({ passwordChangeRequired: false } as PublicUser)
    await render

    expect(loadFeatureFlags).toHaveBeenCalledTimes(1)
  })

  it('skips feature reads when the request redirects to sign-in or password change', async () => {
    vi.mocked(getAuthenticatedUser).mockRejectedValueOnce(new Error('/login'))
    await expect(ProtectedLayout({ children: null })).rejects.toThrow('/login')

    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ passwordChangeRequired: true } as PublicUser)
    await expect(ProtectedLayout({ children: null })).rejects.toThrow(requiredPasswordChangePath)

    expect(loadFeatureFlags).not.toHaveBeenCalled()
  })
})
