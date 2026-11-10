import type { ReactNode } from 'react'
import { IconPlugConnected, IconToggleLeft } from '@tabler/icons-react'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'

export const ServicesPageLayout = ({
  actions,
  children,
  view = 'connections',
  meta
}: {
  actions?: ReactNode
  children: ReactNode
  view?: 'connections' | 'features'
  meta?: ReactNode
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='Services'
      breadcrumbLabel={view === 'features' ? 'Features' : undefined}
      trail={view === 'features' ? [{ label: 'Services', href: '/platform/services' }] : []}
      description={
        view === 'features'
          ? 'Manage platform capabilities and their availability. Changes are saved immediately.'
          : 'Review service health, manage connections, and inspect infrastructure.'
      }
      actions={actions}
      meta={meta}
    />
    <PageContent>
      <ResourceNavigation
        label='Services sections'
        items={[
          {
            id: 'connections',
            label: 'Connections',
            icon: <IconPlugConnected className='size-3.5' />,
            href: '/platform/services',
            current: view === 'connections'
          },
          {
            id: 'features',
            label: 'Features',
            icon: <IconToggleLeft className='size-3.5' />,
            href: '/platform/features',
            current: view === 'features'
          }
        ]}
      />
      {children}
    </PageContent>
  </StandardPage>
)
