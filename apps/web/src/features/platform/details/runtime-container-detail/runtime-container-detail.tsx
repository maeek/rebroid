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
import { ContainerTerminalSection } from './terminal/container-terminal-section'
import type { ActionResult } from '@/shared/actions/action-result'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/shared/contracts/platform'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

export const RuntimeContainerDetail = ({
  details,
  pendingLogs,
  view = 'overview'
}: {
  details: PlatformContainerDetails
  view?: ContainerResourceView
  pendingLogs?: Promise<ActionResult<PlatformContainerLog>>
}) => {
  return (
    <ContainerDetailProvider details={details}>
      <RuntimeContainerDetailContent
        view={view}
        pendingLogs={pendingLogs}
      />
    </ContainerDetailProvider>
  )
}

const RuntimeContainerDetailContent = ({
  view,
  pendingLogs
}: {
  view: ContainerResourceView
  pendingLogs?: Promise<ActionResult<PlatformContainerLog>>
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
          <ContainerLogsSection
            key={container.id}
            containerId={container.id}
            pendingLogs={pendingLogs}
          />
        ) : null}
        {view === 'terminal' ? <ContainerTerminalSection /> : null}
        {view === 'overview' ? (
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
        ) : null}
      </ContainerDetailLayout>

      <ContainerActionDialog />
    </>
  )
}
