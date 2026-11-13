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
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { ContainerDetailLayout } from './container-detail-layout'
import { ContainerResourceHeader } from './container-resource-header'
import { RelatedResourcesSection } from './related-container-sections'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/shared/contracts/platform'

export const RuntimeContainerDetail = ({
  details,
  initialLogs,
  logReadLimitExceeded,
  view = 'overview'
}: {
  details: PlatformContainerDetails
  view?: 'overview' | 'logs'
  initialLogs?: PlatformContainerLog
  logReadLimitExceeded?: boolean
}) => {
  return (
    <ContainerDetailProvider
      details={details}
      initialLogs={initialLogs}
    >
      <RuntimeContainerDetailContent
        view={view}
        logReadLimitExceeded={logReadLimitExceeded}
      />
    </ContainerDetailProvider>
  )
}

const RuntimeContainerDetailContent = ({
  view,
  logReadLimitExceeded
}: {
  view: 'overview' | 'logs'
  logReadLimitExceeded?: boolean
}) => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return (
    <>
      <ContainerDetailLayout
        header={<ContainerResourceHeader />}
        id={container.id}
        view={view}
      >
        {view === 'logs' ? (
          <ContainerLogsSection logReadLimitExceeded={logReadLimitExceeded} />
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
      </ContainerDetailLayout>

      <ContainerActionDialog />
    </>
  )
}
