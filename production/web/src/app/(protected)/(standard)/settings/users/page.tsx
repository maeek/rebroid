import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'
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
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='Users'
          sectionTitle='Existing users'
          rows={4}
        />
      }
    >
      <UsersSettingsContent />
    </Suspense>
  )
}
