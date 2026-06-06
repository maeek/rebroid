import { Suspense } from 'react'
import { GroupsSettings } from '@/features/settings/users/groups-settings'
import { GroupsPageSkeleton } from '@/features/settings/users/user-page-skeletons'
import { userService } from '@/server/auth/user'

const UserGroupsSettingsContent = async () => {
  const groups = await userService.listGroups()

  return <GroupsSettings initialGroups={groups} />
}

export default function UserGroupsSettingsPage() {
  return (
    <Suspense fallback={<GroupsPageSkeleton />}>
      <UserGroupsSettingsContent />
    </Suspense>
  )
}
