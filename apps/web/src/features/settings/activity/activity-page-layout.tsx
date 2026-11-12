import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ActivityPageLayout = ({ children }: { children: ReactNode }) => (
  <StandardPage
    gridToolbar
    className='gap-2'
  >
    <PageHeader
      section={{ label: 'Administration' }}
      title='Audit log'
      description='Review administrative and application activity. Select an event to inspect its details.'
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
