import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getServerAuthSession } from './auth'
import { userService } from './user'

export const getCurrentUser = cache(async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await userService.getUserById(session.user.id)
  if (!user || user.disabled || user.sessionVersion !== session.user.sessionVersion) {
    redirect('/login')
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
