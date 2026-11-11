import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ServicesPageLayout = ({
  breadcrumbRefresh,
  children
}: {
  breadcrumbRefresh?: ReactNode
  children: ReactNode
}) => (
  <StandardPage
    gridToolbar
    className='gap-2'
  >
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='Services'
      description='Review service health, manage connections, and inspect infrastructure.'
      breadcrumbRefresh={breadcrumbRefresh}
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
