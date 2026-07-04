import { Suspense } from 'react'
import { UsersPageSkeleton } from '../../user-page-skeletons'
import { UsersSettings } from '../../users-settings'
import { getUsersListPageData } from './page-data.server'

const UsersListContent = async () => {
  const { users, groups, passwordMinimumLength } = await getUsersListPageData()

  return (
    <UsersSettings
      initialUsers={users}
      initialGroups={groups}
      initialPasswordMinimumLength={passwordMinimumLength}
    />
  )
}

export default function UsersListPageEntry() {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersListContent />
    </Suspense>
  )
}
