import type { ComponentProps, ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const ServiceDetailLayout = ({
  title,
  refresh,
  actions,
  children,
  navigation = { section: { label: 'System' }, trail: [{ label: 'Services', href: '/platform/services' }] }
}: {
  title: string
  refresh: ReactNode
  actions?: ReactNode
  children: ReactNode
  navigation?: Pick<ComponentProps<typeof PageHeader>, 'section' | 'trail' | 'breadcrumbLabel'>
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      {...navigation}
      title={title}
      breadcrumbRefresh={refresh}
      actions={actions}
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)
