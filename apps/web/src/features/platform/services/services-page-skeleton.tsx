'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { InfrastructureServiceSkeleton } from './infrastructure-service-skeleton'
import { isConfigurableService, visibleOptionalServiceIds } from './service-definitions'
import { ServiceSettingsPage } from './service-settings-page'
import { ServicesGrid } from './services-grid'
import { ServicesPageLayout } from './services-page-layout'

export const PlatformServicesPageSkeleton = () => (
  <Suspense fallback={<ServicesInventorySkeleton />}>
    <ServicesRouteSkeleton />
  </Suspense>
)

const ServicesRouteSkeleton = () => {
  const service = useSearchParams().get('service')
  if (service === 'docker' || service === 'orchestrator') return <InfrastructureServiceSkeleton serviceId={service} />
  if (isConfigurableService(service)) {
    return (
      <ServiceSettingsPage
        serviceId={service}
        loading
      />
    )
  }
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
