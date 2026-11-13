'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { ContainerDetailLayout } from '../../details/runtime-container-detail/container-detail-layout'
import { ContainerLogsContent } from '../../details/runtime-container-detail/container-logs-section'
import { ContainerOverviewContent } from '../../details/runtime-container-detail/container-overview-section'
import { ContainerResourceHeading } from '../../details/runtime-container-detail/container-resource-header'
import { RelatedResourcesSkeleton } from '../../details/runtime-container-detail/related-container-sections'

export const RuntimeContainerDetailPageLoading = () => (
  <Suspense fallback={<ContainerLoadingContent />}>
    <ContainerRouteLoading />
  </Suspense>
)

const ContainerRouteLoading = () => (
  <ContainerLoadingContent view={useSearchParams().get('view') === 'logs' ? 'logs' : 'overview'} />
)

export const ContainerLoadingContent = ({ view = 'overview' }: { view?: 'overview' | 'logs' }) => (
  <ContainerDetailLayout
    header={<ContainerResourceHeading />}
    view={view}
  >
    {view === 'logs' ? (
      <ContainerLogsContent loading />
    ) : (
      <>
        <ContainerOverviewContent loading />
        <RelatedResourcesSkeleton />
        <PlatformLabelsSection
          labels={{}}
          loading
        />
        <JsonViewer
          title='Raw inspect'
          value={null}
          loading
        />
      </>
    )}
  </ContainerDetailLayout>
)
