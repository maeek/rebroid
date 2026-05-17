import { UsersSettings } from '@/features/settings/users/users-settings'
import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export default async function UsersSettingsPage() {
  await requireAdmin()
  const users = await userService.listUsers()
  return <UsersSettings initialUsers={users} />
}
