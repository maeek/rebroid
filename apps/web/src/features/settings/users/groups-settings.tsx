'use client'

import { useState } from 'react'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { GroupsSection } from './components/groups-section'
import type { UserGroup } from '@/server/auth/user'

export const GroupsSettings = ({ initialGroups }: { initialGroups: UserGroup[] }) => {
  const [groups, setGroups] = useState(initialGroups)

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <PageBreadcrumbs
          className='pt-0'
          items={[{ label: 'Users', href: '/users' }, { label: 'Groups' }]}
        />
        <h2 className='pt-4 text-3xl font-medium max-sm:text-xl'>Groups</h2>
      </section>
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
    </ProtectedStackPageLayout>
  )
}
