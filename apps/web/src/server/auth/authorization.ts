import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getServerAuthSession } from './auth'
import { requiredPasswordChangePath } from './password-change-routing'
import { isCurrentAccountSession } from './session-identity'
import { userService } from './user'

const getAuthenticatedAccount = cache(async () => {
  const session = await getServerAuthSession()
  if (!session?.user || typeof session.user.sessionVersion !== 'number' || typeof session.user.authEpoch !== 'string') {
    redirect('/login')
  }

  const identity = {
    userId: session.user.id,
    sessionVersion: session.user.sessionVersion,
    authEpoch: session.user.authEpoch
  }
  const user = await userService.getUserById(identity.userId)
  if (!user || !isCurrentAccountSession(user, identity)) redirect('/login')
  return { user, identity }
})

const getCurrentAccount = cache(async () => {
  const account = await getAuthenticatedAccount()
  if (account.user.passwordChangeRequired) redirect(requiredPasswordChangePath)
  return account
})

export const getAuthenticatedUser = cache(async () => (await getAuthenticatedAccount()).user)

export const getCurrentUser = cache(async () => (await getCurrentAccount()).user)

export const getCurrentSessionIdentity = async () => (await getCurrentAccount()).identity

export const requireAdmin = async () => {
  const user = await getCurrentUser()
  if (!user.isPlatformAdmin) {
    redirect('/apps')
  }
  return user
}
