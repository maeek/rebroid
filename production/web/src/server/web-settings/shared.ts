import { getServerAuthSession } from '@/server/auth/auth'

export const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}
