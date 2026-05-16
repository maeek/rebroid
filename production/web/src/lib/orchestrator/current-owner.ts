import { getServerAuthSession } from '@/server/auth/auth'

export const getCurrentOwnerUserId = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }

  return session.user.id || session.user.email || session.user.name || 'admin'
}
