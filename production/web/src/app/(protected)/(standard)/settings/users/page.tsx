import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { UsersSettings } from './users-settings'

export default async function UsersSettingsPage() {
  await requireAdmin()
  const users = await userService.listUsers()
  return <UsersSettings initialUsers={users} />
}
