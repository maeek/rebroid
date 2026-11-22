import { cache } from 'react'
import { redirect } from 'next/navigation'
import { PublicActionError } from '@/server/errors/public-action-error'
import { isCurrentAccountSession } from './account-sessions'
import { getServerAuthSession } from './auth'
import { requiredPasswordChangePath } from './password-change-routing'
import { readAccountSessionIdentity } from './session-identity'
import { userService } from './user'

type AuthResponse = 'redirect' | 'api'

const accountUnavailable = (response: AuthResponse, path: string): never => {
  if (response === 'api') {
    throw new PublicActionError('Sign in to continue.', { code: 'unauthenticated', status: 401 })
  }
  redirect(path)
}

const findAuthenticatedAccount = cache(async () => {
  const session = await getServerAuthSession()
  const identity = readAccountSessionIdentity({ ...session?.user, userId: session?.user?.id })
  if (!identity) return null
  const user = await userService.getUserById(identity.userId)
  if (!user || !isCurrentAccountSession(user, identity)) return null
  return { user, identity }
})

const getAuthenticatedAccount = async (response: AuthResponse = 'redirect') =>
  (await findAuthenticatedAccount()) ?? accountUnavailable(response, '/login')

const getCurrentAccount = cache(async (response: AuthResponse = 'redirect') => {
  const account = await getAuthenticatedAccount(response)
  if (account.user.passwordChangeRequired) accountUnavailable(response, requiredPasswordChangePath)
  return account
})

export const getAuthenticatedUser = cache(async () => (await getAuthenticatedAccount()).user)

export const getCurrentUser = cache(async (response?: AuthResponse) => (await getCurrentAccount(response)).user)

export const getCurrentSessionIdentity = async () => (await getCurrentAccount()).identity

export const requireAdmin = async (response?: 'api') => {
  const user = await getCurrentUser(response)
  if (!user.isPlatformAdmin) {
    if (response === 'api')
      throw new PublicActionError('Administrator access is required.', { code: 'forbidden', status: 403 })
    redirect('/apps')
  }
  return user
}
