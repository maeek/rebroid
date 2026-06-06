import { Suspense } from 'react'
import { UsersPageSkeleton } from '@/features/settings/users/user-page-skeletons'
import { UsersSettings } from '@/features/settings/users/users-settings'
import { userService } from '@/server/auth/user'

const UsersSettingsContent = async () => {
  const [users, groups] = await Promise.all([userService.listUsers(), userService.listGroups()])
  return (
    <UsersSettings
      initialUsers={users}
      initialGroups={groups}
    />
  )
}

export default function UsersSettingsPage() {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersSettingsContent />
    </Suspense>
  )
}
