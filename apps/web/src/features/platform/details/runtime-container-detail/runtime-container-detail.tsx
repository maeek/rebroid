'use client'

import { ContainerActionDialog } from '@/features/platform/details/runtime-container-detail/container-action-dialog'
import {
  ContainerDetailProvider,
  useContainerDetailContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { ContainerLogsSection } from '@/features/platform/details/runtime-container-detail/container-logs-section'
import { ContainerOverviewSection } from '@/features/platform/details/runtime-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/platform/details/runtime-container-detail/live-resources-section'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { ContainerResourceHeader } from './container-resource-header'
import { ContainerResourceNavigation } from './container-resource-navigation'
import { RelatedResourcesSection } from './related-container-sections'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/shared/contracts/platform'

export const RuntimeContainerDetail = ({
  details,
  initialLogs,
  view = 'overview'
}: {
  details: PlatformContainerDetails
  view?: 'overview' | 'logs'
  initialLogs?: PlatformContainerLog
}) => {
  return (
    <ContainerDetailProvider
      details={details}
      initialLogs={initialLogs}
    >
      <RuntimeContainerDetailContent view={view} />
    </ContainerDetailProvider>
  )
}

const RuntimeContainerDetailContent = ({ view }: { view: 'overview' | 'logs' }) => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return (
    <>
      <ContainerResourceHeader />
      <PageContent>
        <ContainerResourceNavigation
          id={container.id}
          view={view}
        />
        {view === 'logs' ? (
          <ContainerLogsSection />
        ) : (
          <>
            <ContainerOverviewSection />
            <RelatedResourcesSection />

            {container.state === 'running' ? <LiveResourcesSection /> : null}

            <PlatformLabelsSection labels={container.labels} />
            <JsonViewer
              title='Raw inspect'
              value={details.inspect}
            />
          </>
        )}
      </PageContent>

      <ContainerActionDialog />
    </>
  )
}
