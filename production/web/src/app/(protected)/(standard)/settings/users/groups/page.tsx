import { GroupsSettings } from '@/features/settings/users/groups-settings'
import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export default async function UserGroupsSettingsPage() {
  await requireAdmin()
  const groups = await userService.listGroups()

  return <GroupsSettings initialGroups={groups} />
}
