import type { ComponentProps, ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { serviceHealthState, type DisplayServiceHealth } from '@/shared/model/diagnostics/service-health'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ServiceHealthNotice } from './service-health-notice'

export const ServiceDetailLayout = ({
  title,
  refresh,
  actions,
  children,
  health,
  healthNotice,
  loading = false,
  gridToolbar = false,
  navigation = { section: { label: 'System' }, trail: [{ label: 'Services', href: '/platform/services' }] }
}: {
  title: string
  refresh: ReactNode
  actions?: ReactNode
  children: ReactNode
  health?: DisplayServiceHealth
  healthNotice?: Omit<ComponentProps<typeof ServiceHealthNotice>, 'health'>
  loading?: boolean
  gridToolbar?: boolean
  navigation?: Pick<ComponentProps<typeof PageHeader>, 'section' | 'trail' | 'breadcrumbLabel'>
}) => {
  const healthy = health?.status === 'healthy'
  let titleBadge
  if (loading) {
    titleBadge = <Skeleton className='h-5.5 w-16 rounded-full' />
  } else if (healthy) {
    const { label, tone } = serviceHealthState(health)
    titleBadge = (
      <StatusBadge
        role='status'
        className='rounded-full'
        tone={tone}
      >
        {label}
      </StatusBadge>
    )
  }

  return (
    <StandardPage
      className='gap-2'
      gridToolbar={gridToolbar}
    >
      <PageHeader
        {...navigation}
        title={title}
        titleBadge={titleBadge}
        breadcrumbRefresh={refresh}
        actions={actions}
      />
      <PageContent>
        {!loading && !healthy ? (
          <ServiceHealthNotice
            {...healthNotice}
            health={health}
          />
        ) : null}
        {children}
      </PageContent>
    </StandardPage>
  )
}
