import { GroupsSettings } from '@/features/settings/users/groups-settings'
import { userService } from '@/server/auth/user'

export default async function UserGroupsSettingsPage() {
  const groups = await userService.listGroups()

  return <GroupsSettings initialGroups={groups} />
}
