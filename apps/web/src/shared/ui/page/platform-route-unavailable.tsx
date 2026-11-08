import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from './page-load-failure'

export const PlatformRouteUnavailable = ({
  title,
  leading,
  description,
  section
}: {
  title: string
  leading?: ReactNode
  description: string
  section: { label: string; href?: string }
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      title={title}
      leading={leading}
      description={description}
      section={section}
    />
    <PageContent>
      <PageLoadFailure
        title='Service unavailable'
        description='The page could not load data from the orchestrator.'
        backAction={{ label: 'Back to apps', href: '/apps' }}
      />
    </PageContent>
  </StandardPage>
)
