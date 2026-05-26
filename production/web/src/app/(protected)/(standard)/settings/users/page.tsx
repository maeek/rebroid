import { UsersSettings } from '@/features/settings/users/users-settings'
import { userService } from '@/server/auth/user'

export default async function UsersSettingsPage() {
  const users = await userService.listUsers()
  const groups = await userService.listGroups()
  return (
    <UsersSettings
      initialUsers={users}
      initialGroups={groups}
    />
  )
}
