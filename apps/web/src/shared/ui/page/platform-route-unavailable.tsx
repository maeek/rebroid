import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export const PlatformRouteUnavailable = ({
  title,
  leading,
  description,
  href,
  section,
  actionLabel = 'Refresh'
}: {
  title: string
  leading?: ReactNode
  description: string
  href: string
  section: { label: string; href?: string }
  actionLabel?: string
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      title={title}
      leading={leading}
      description={description}
      section={section}
    />
    <PageContent>
      <StateView
        kind='unavailable'
        title='Service unavailable'
        description='The page could not load data from the orchestrator.'
        actions={[
          { label: actionLabel, href },
          { label: 'Back to apps', href: '/apps' }
        ]}
      />
    </PageContent>
  </StandardPage>
)
