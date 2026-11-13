'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FirewallPageLoading } from '@/features/platform/pages/firewall/page-loading'
import { OcrPageLoading } from '@/features/platform/pages/ocr/page-loading'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DockerOverviewLoading, InfrastructureServiceSkeleton } from './infrastructure-service-skeleton'
import { visibleOptionalServiceIds } from './service-definitions'
import { ServicesGrid } from './services-grid'
import { ServicesPageLayout } from './services-page-layout'

export const PlatformServicesPageSkeleton = () => (
  <Suspense fallback={<ServicesInventorySkeleton />}>
    <ServicesRouteSkeleton />
  </Suspense>
)

const ServicesRouteSkeleton = () => {
  const service = useSearchParams().get('service')
  if (service === 'docker') return <DockerOverviewLoading />
  if (service === 'orchestrator') return <InfrastructureServiceSkeleton serviceId={service} />
  if (service === 'firewall') return <FirewallPageLoading />
  if (service === 'ocr') return <OcrPageLoading />
  return <ServicesInventorySkeleton />
}

export const ServicesInventorySkeleton = () => {
  const { getFeature } = useFeatureFlags()
  const requiredServiceCount = 3
  return (
    <ServicesPageLayout
      breadcrumbRefresh={
        <PlatformPageRefreshButton
          disabled
          onRefresh={() => undefined}
        />
      }
    >
      <ServicesGrid
        rows={[]}
        loadingRowCount={requiredServiceCount + visibleOptionalServiceIds(getFeature).length}
        onActivate={() => undefined}
      />
    </ServicesPageLayout>
  )
}
