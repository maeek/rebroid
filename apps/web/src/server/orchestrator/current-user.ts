import { cache } from 'react'
import { getCurrentUser } from '@/server/auth/authorization'

export const getCurrentUserContext = cache(async (response?: 'api') => {
  const user = response ? await getCurrentUser(response) : await getCurrentUser()

  return {
    ownerUserId: user.id || user.name || 'admin',
    isPlatformAdmin: user.isPlatformAdmin,
    permissions: user.effectivePermissions,
    quotas: user.effectiveQuotas
  }
})
