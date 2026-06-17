'use client'

import { useState } from 'react'
import { Section } from '@/components/ui/section'
import { DockerMetricsDashboard } from '@/features/platform/metrics/docker-metrics-dashboard'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PlatformQuickGlanceSection } from './platform-quick-glance-section'

export const PlatformOverviewPageClient = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingRefreshes, setPendingRefreshes] = useState(0)

  const refresh = () => {
    setPendingRefreshes(2)
    setRefreshKey(current => current + 1)
  }

  const completeRefresh = () => {
    setPendingRefreshes(current => Math.max(current - 1, 0))
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Overview'
        description='Managed containers, resource usage, Docker API workload, latency, retries, and recent transport failures.'
        actions={
          <PlatformPageRefreshButton
            isRefreshing={pendingRefreshes > 0}
            onRefresh={refresh}
          />
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-4 max-sm:px-4'>
        <Section
          title='Resources'
          titleClassName='pb-2'
          contentClassName='gap-4'
        >
          <PlatformQuickGlanceSection
            refreshKey={refreshKey}
            onRefreshComplete={completeRefresh}
          />
        </Section>
      </section>
      <DockerMetricsDashboard
        title='Metrics'
        refreshKey={refreshKey}
        onRefreshComplete={completeRefresh}
      />
    </ProtectedStackPageLayout>
  )
}
