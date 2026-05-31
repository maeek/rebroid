import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'
import { GroupsSettings } from '@/features/settings/users/groups-settings'
import { userService } from '@/server/auth/user'

const UserGroupsSettingsContent = async () => {
  const groups = await userService.listGroups()

  return <GroupsSettings initialGroups={groups} />
}

export default function UserGroupsSettingsPage() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='Groups'
          sectionTitle='Existing groups'
          rows={3}
        />
      }
    >
      <UserGroupsSettingsContent />
    </Suspense>
  )
}
