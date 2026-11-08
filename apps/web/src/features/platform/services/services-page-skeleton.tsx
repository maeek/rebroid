'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { InfrastructureServiceSkeleton } from './infrastructure-service-skeleton'
import { ServicesGrid } from './services-grid'
import { ServicesPageActions, ServicesSaveStatus } from './services-page-actions'
import { ServicesPageLayout } from './services-page-layout'

export const PlatformServicesPageSkeleton = () => (
  <Suspense fallback={<ServicesInventorySkeleton />}>
    <ServicesRouteSkeleton />
  </Suspense>
)

const ServicesRouteSkeleton = () => {
  const service = useSearchParams().get('service')
  if (service === 'docker' || service === 'orchestrator') return <InfrastructureServiceSkeleton serviceId={service} />
  return <ServicesInventorySkeleton />
}

export const ServicesInventorySkeleton = () => {
  const { isFeatureEnabled } = useFeatureFlags()
  const hasConfiguration = isFeatureEnabled('feature.ocr') || isFeatureEnabled('feature.firewall')
  return (
    <ServicesPageLayout
      actions={
        <>
          <PlatformPageRefreshButton
            disabled
            onRefresh={() => undefined}
          />
          {hasConfiguration ? <ServicesPageActions disabled /> : null}
        </>
      }
      meta={hasConfiguration ? <ServicesSaveStatus loading /> : undefined}
    >
      <ServicesGrid
        rows={[]}
        loading
        onEdit={() => undefined}
        onActivate={() => undefined}
      />
    </ServicesPageLayout>
  )
}
