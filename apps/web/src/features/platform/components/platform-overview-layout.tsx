import type { ReactNode } from 'react'
import { Section } from '@/components/ui/section'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceLink } from '@/shared/ui/resource-link'

export const PlatformOverviewLayout = ({
  actions,
  operations,
  capacity
}: {
  actions: ReactNode
  operations: ReactNode
  capacity: ReactNode
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      title='Overview'
      description='App failures, active operations, and platform capacity.'
      actions={actions}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-4 max-sm:px-4'>
      {operations}
      <Section
        surface='plain'
        title='Capacity'
        headingSpacing='compact'
        contentClassName='gap-4'
        actions={<ResourceLink href='/platform/services?service=docker'>Infrastructure diagnostics</ResourceLink>}
      >
        {capacity}
      </Section>
    </section>
  </StandardPage>
)
