'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { readContainerResourceView, type ContainerResourceView } from '@/shared/model/container-resource-href'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { ContainerDetailLayout } from '../../details/runtime-container-detail/container-detail-layout'
import { ContainerLogsContent } from '../../details/runtime-container-detail/container-logs-section'
import { ContainerOverviewContent } from '../../details/runtime-container-detail/container-overview-section'
import { ContainerResourceHeading } from '../../details/runtime-container-detail/container-resource-header'
import { RelatedResourcesSkeleton } from '../../details/runtime-container-detail/related-container-sections'
import { ContainerTerminalContent } from '../../details/runtime-container-detail/terminal/container-terminal-section'

export const RuntimeContainerDetailPageLoading = () => (
  <Suspense fallback={<ContainerLoadingContent />}>
    <ContainerRouteLoading />
  </Suspense>
)

const ContainerRouteLoading = () => (
  <ContainerLoadingContent view={readContainerResourceView(useSearchParams().get('view'))} />
)

const ContainerLoadingContent = ({ view = 'overview' }: { view?: ContainerResourceView }) => (
  <ContainerDetailLayout
    header={<ContainerResourceHeading />}
    view={view}
  >
    {view === 'logs' ? (
      <ContainerLogsContent loading />
    ) : view === 'terminal' ? (
      <ContainerTerminalContent loading />
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
