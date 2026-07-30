'use client'

import { useState } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { CreateGroupDialog } from './components/create-group-dialog'
import { GroupsSection } from './components/groups-section'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const GroupsSettings = ({ initialGroups }: { initialGroups: UserGroup[] }) => {
  const [groups, setGroups] = useState(initialGroups)

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Security' }}
        title='Groups'
        actions={
          <CreateGroupDialog
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
          groups={groups}
          onGroupsDeleted={groupIds => setGroups(current => current.filter(group => !groupIds.has(group.id)))}
        />
      </PageContent>
    </StandardPage>
  )
}
