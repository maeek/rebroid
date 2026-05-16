import { redirect } from 'next/navigation'
import { getServerAuthSession } from './auth'

export const requireAdmin = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    redirect('/login')
  }
  if (session.user.role !== 'admin') {
    redirect('/apps')
  }
  return session
}
