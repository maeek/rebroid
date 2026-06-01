import { getCurrentUser, requireAdmin } from '@/server/auth/authorization'

export const requireUser = async () => {
  return getCurrentUser()
}

export const requireAdminUser = async () => {
  return requireAdmin()
}
