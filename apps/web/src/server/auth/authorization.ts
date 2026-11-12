import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isCurrentAccountSession } from './account-sessions'
import { getServerAuthSession } from './auth'
import { requiredPasswordChangePath } from './password-change-routing'
import { readAccountSessionIdentity } from './session-identity'
import { userService } from './user'

const getAuthenticatedAccount = cache(async () => {
  const session = await getServerAuthSession()
  const identity = readAccountSessionIdentity({ ...session?.user, userId: session?.user?.id })
  if (!identity) redirect('/login')
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
