'use client'

import { useState } from 'react'
import { IconActivity, IconFolder, IconLayoutDashboard, IconSettings } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { TabsList, TabsPanel, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'
import { ResourceNavigationMotionScope } from '@/shared/ui/resource-navigation-motion-scope'

const sections = [
  { id: 'overview', label: 'Overview', Icon: IconLayoutDashboard },
  { id: 'files', label: 'Files', Icon: IconFolder },
  { id: 'activity', label: 'Activity', Icon: IconActivity },
  { id: 'configuration', label: 'Configuration', Icon: IconSettings }
]

export const ResourceNavigationPreview = () => {
  const search = useSearchParams()
  const current = search.get('section') ?? 'overview'
  const [tab, setTab] = useState('overview')
  return (
    <StandardPage>
      <PageHeader title='Resource navigation preview' />
      <PageContent>
        <Section
          title='App sections'
          surface='plain'
          contentClassName='gap-4'
        >
          <ResourceNavigationMotionScope>
            <ResourceNavigation
              key={current}
              label='Preview sections'
              preserveScroll
              items={sections.map(({ id, label, Icon }) => ({
                id,
                label,
                icon: <Icon className='size-3.5' />,
                current: id === current,
                href: `/skeleton-contract-test?editor=resource-navigation&section=${id}`
              }))}
            />
          </ResourceNavigationMotionScope>
          <p>Current section: {current}</p>
        </Section>
        <Section
          title='In-page tabs'
          surface='plain'
        >
          <TabsRoot
            value={tab}
            onValueChange={setTab}
            className='grid gap-4'
          >
            <TabsList
              variant='resource'
              ariaLabel='Preview tabs'
            >
              {sections.map(({ id, label, Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  icon={<Icon className='size-3.5' />}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {sections.map(({ id, label }) => (
              <TabsPanel
                key={id}
                value={id}
              >
                {label} content
              </TabsPanel>
            ))}
          </TabsRoot>
        </Section>
      </PageContent>
    </StandardPage>
  )
}
