import { cache } from 'react'
import { getCurrentUser } from '@/server/auth/authorization'

export const getCurrentOwnerUserId = async () => {
  const user = await getCurrentUser()
  return user.id || user.name || 'admin'
}

export const getCurrentUserContext = cache(async () => {
  const user = await getCurrentUser()

  return {
    ownerUserId: user.id || user.name || 'admin',
    role: user.role,
    permissions: user.effectivePermissions,
    quotas: user.effectiveQuotas
  }
})
