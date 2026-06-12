import { Suspense } from 'react'
import { GroupsSettings } from '../../groups-settings'
import { GroupsPageSkeleton } from '../../user-page-skeletons'
import { getGroupsListPageData } from './page-data.server'

const GroupsListContent = async () => {
  const { groups } = await getGroupsListPageData()

  return <GroupsSettings initialGroups={groups} />
}

export default function GroupsListPageEntry() {
  return (
    <Suspense fallback={<GroupsPageSkeleton />}>
      <GroupsListContent />
    </Suspense>
  )
}
