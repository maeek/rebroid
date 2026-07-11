import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getAuthEpoch } from '@/server/persistence/auth-security-repository'
import { getServerAuthSession } from './auth'
import { requiredPasswordChangePath } from './password-change-routing'
import { userService } from './user'

export const getAuthenticatedUser = cache(async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await userService.getUserById(session.user.id)
  if (
    !user ||
    user.disabled ||
    user.sessionVersion !== session.user.sessionVersion ||
    session.user.authEpoch !== getAuthEpoch()
  ) {
    redirect('/login')
  }

  return user
})

export const getCurrentUser = cache(async () => {
  const user = await getAuthenticatedUser()
  if (user.passwordChangeRequired) {
    redirect(requiredPasswordChangePath)
  }
  return user
})

export const requireAdmin = async () => {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    redirect('/apps')
  }
  return user
}
