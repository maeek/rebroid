import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/authorization'

export const requireAdminUser = async () => {
  await requireAdmin()
}

export const revalidateUsersPage = () => {
  revalidatePath('/settings/users')
}
