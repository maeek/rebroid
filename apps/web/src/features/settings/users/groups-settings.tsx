'use client'

import { useState } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { CreateGroupDialog } from './components/create-group-dialog'
import { GroupsSection } from './components/groups-section'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const GroupsSettings = ({
  initialGroups,
  loading = false
}: {
  initialGroups: UserGroup[]
  loading?: boolean
}) => {
  const [groups, setGroups] = useState(initialGroups)

  return (
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <PageHeader
        section={{ label: 'Security' }}
        title='Groups'
        description='Groups provide the permissions and quotas that members inherit.'
        actions={
          <CreateGroupDialog
            disabled={loading}
            onCreated={group =>
              setGroups(current =>
                current.some(item => item.id === group.id)
                  ? current.map(item => (item.id === group.id ? group : item))
                  : [...current, group]
              )
            }
          />
        }
      />
      <PageContent>
        <GroupsSection
          loading={loading}
          groups={groups}
          onGroupsDeleted={groupIds => setGroups(current => current.filter(group => !groupIds.has(group.id)))}
        />
      </PageContent>
    </StandardPage>
  )
}
