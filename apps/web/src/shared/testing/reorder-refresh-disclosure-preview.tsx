'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Disclosure, DisclosureSummary, DisclosureChevron } from '@/components/ui/disclosure'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { GroupMembershipEditor } from '@/features/settings/users/components/group-membership-editor'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ReorderRefreshDisclosurePreview = () => {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState({ version: 0, succeeded: true })
  const [groups, setGroups] = useState(Array.from({ length: 7 }, (_, index) => `Group ${index + 1}`))
  const complete = (succeeded: boolean) => {
    setResult(previous => ({ version: previous.version + 1, succeeded }))
    setPending(false)
  }
  return (
    <StandardPage>
      <PageHeader
        title='Interaction feedback'
        breadcrumbRefresh={
          <PlatformPageRefreshButton
            isRefreshing={pending}
            refreshResult={result}
            onRefresh={() => setPending(true)}
          />
        }
      />
      <PageContent>
        <div className='flex gap-2'>
          <Button onClick={() => complete(true)}>Complete refresh</Button>
          <Button onClick={() => complete(false)}>Fail refresh</Button>
        </div>
        <Section
          surface='panel'
          title='Group priority'
        >
          <GroupMembershipEditor
            groups={[]}
            selectedGroupIds={groups}
            onChange={setGroups}
          />
        </Section>
        <Section
          surface='panel'
          title='Advanced settings'
          collapsible
        >
          <Input
            aria-label='Retained draft'
            defaultValue='Draft'
          />
        </Section>
        <Disclosure className='rounded-control'>
          <DisclosureSummary className='flex list-none items-center gap-2 py-2'>
            <DisclosureChevron
              direction='right'
              className='size-4'
            />
            Event details
          </DisclosureSummary>
          <Disclosure>
            <DisclosureSummary className='flex list-none items-center gap-2 py-2'>
              <DisclosureChevron
                direction='right'
                className='size-4'
              />
              Nested details
            </DisclosureSummary>
            <p>Event payload</p>
          </Disclosure>
        </Disclosure>
      </PageContent>
    </StandardPage>
  )
}
