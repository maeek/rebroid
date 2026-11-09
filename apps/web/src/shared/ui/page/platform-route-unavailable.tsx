import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from './page-load-failure'
import type { StateViewAction } from '@/shared/ui/state-view'

export const PlatformRouteUnavailable = ({
  title,
  leading,
  description,
  section,
  trail,
  backAction = { label: 'Go to overview', href: '/platform' },
  requestId
}: {
  title: string
  leading?: ReactNode
  description: string
  section?: { label: string; href?: string }
  trail?: { label: string; href?: string }[]
  backAction?: StateViewAction | null
  requestId?: string
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      title={title}
      leading={leading}
      description={description}
      section={section}
      trail={trail}
    />
    <PageContent>
      <PageLoadFailure
        requestId={requestId}
        title='Unable to reach the runtime service'
        description='Rebroid is open, but the orchestrator could not provide this page’s data. Try again in a moment. If this continues, ask an administrator to check the service.'
        backAction={backAction ?? undefined}
      />
    </PageContent>
  </StandardPage>
)
