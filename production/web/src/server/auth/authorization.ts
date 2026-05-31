import { cache } from 'react'
import { redirect } from 'next/navigation'
import { hasPermission, type PermissionId } from '@/shared/permissions/permissions'
import { getServerAuthSession } from './auth'
import { userService } from './user'

export const getCurrentUser = cache(async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    redirect('/login')
  }

  const user = await userService.getUserById(session.user.id)
  if (!user || user.disabled) {
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

export const requirePermission = async (permission: PermissionId) => {
  const user = await getCurrentUser()
  if (user.role !== 'admin' && !hasPermission(user.effectivePermissions, permission)) {
    throw new Error('You do not have permission to perform this action.')
  }
  return user
}
