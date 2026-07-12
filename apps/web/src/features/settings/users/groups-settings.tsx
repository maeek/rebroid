'use client'

import { useState } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { GroupsSection } from './components/groups-section'
import type { UserGroup } from '@/server/auth/user'

export const GroupsSettings = ({ initialGroups }: { initialGroups: UserGroup[] }) => {
  const [groups, setGroups] = useState(initialGroups)

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Security' }}
        title='Groups'
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <GroupsSection
          groups={groups}
          onGroupUpdated={group =>
            setGroups(current =>
              current.some(item => item.id === group.id)
                ? current.map(item => (item.id === group.id ? group : item))
                : [...current, group]
            )
          }
          onGroupsDeleted={groupIds => setGroups(current => current.filter(group => !groupIds.has(group.id)))}
        />
      </section>
    </StandardPage>
  )
}
