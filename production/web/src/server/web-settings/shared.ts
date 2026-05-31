import { getCurrentUser } from '@/server/auth/authorization'

export const requireUser = async () => {
  return getCurrentUser()
}
