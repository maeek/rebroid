import type { ReactNode } from 'react'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
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
    <CompactPageHeader
      section={{ label: 'System' }}
      title='Services'
      description='Review service health, manage connections, and inspect infrastructure.'
      breadcrumbRefresh={breadcrumbRefresh}
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
