import { revalidatePath } from 'next/cache'
import { getCurrentSessionIdentity, requireAdmin } from '@/server/auth/authorization'

export const requireAdminUser = async () => {
  const admin = await requireAdmin()
  return { ...admin, identity: await getCurrentSessionIdentity() }
}

export const revalidateUsersPage = () => {
  revalidatePath('/security/users')
}
