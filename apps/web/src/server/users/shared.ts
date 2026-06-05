import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/authorization'

export const requireAdminUser = async () => {
  return requireAdmin()
}

export const revalidateUsersPage = () => {
  revalidatePath('/users')
}
