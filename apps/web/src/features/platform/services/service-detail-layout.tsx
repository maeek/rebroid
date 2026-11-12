import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ServiceDetailLayout = ({
  title,
  refresh,
  actions,
  children
}: {
  title: string
  refresh: ReactNode
  actions?: ReactNode
  children: ReactNode
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'System' }}
      trail={[{ label: 'Services', href: '/platform/services' }]}
      title={title}
      breadcrumbRefresh={refresh}
      actions={actions}
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
