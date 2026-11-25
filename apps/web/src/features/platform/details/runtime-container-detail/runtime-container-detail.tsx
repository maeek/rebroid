'use client'

import { ContainerActionDialog } from '@/features/platform/details/runtime-container-detail/container-action-dialog'
import { ContainerDetailProvider } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { ContainerLogsSection } from '@/features/platform/details/runtime-container-detail/container-logs-section'
import { ContainerOverviewContent } from '@/features/platform/details/runtime-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/platform/details/runtime-container-detail/live-resources-section'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { ContainerDetailLayout } from './container-detail-layout'
import { ContainerResourceHeader } from './container-resource-header'
import { RelatedResourcesSection } from './related-container-sections'
import { ContainerTerminalSection } from './terminal/container-terminal-section'
import type { ActionResult } from '@/shared/actions/action-result'
import type {
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformContainerSummary
} from '@/shared/contracts/platform'

type RuntimeContainerDetailProps =
  | { view: 'overview'; details: PlatformContainerDetails }
  | { view: 'logs'; summary: PlatformContainerSummary; pendingLogs?: Promise<ActionResult<PlatformContainerLog>> }
  | { view: 'terminal'; summary: PlatformContainerSummary }

export const RuntimeContainerDetail = (props: RuntimeContainerDetailProps) => {
  const { view } = props
  const container = view === 'overview' ? props.details.container : props.summary.container

  return (
    <ContainerDetailProvider container={container}>
      <ContainerDetailLayout
        header={<ContainerResourceHeader />}
        id={container.id}
        view={view}
      >
        {view === 'logs' ? (
          <ContainerLogsSection
            key={container.id}
            containerId={container.id}
            pendingLogs={props.pendingLogs}
          />
        ) : null}
        {view === 'terminal' ? <ContainerTerminalSection {...props.summary} /> : null}
        {view === 'overview' ? (
          <>
            <ContainerOverviewContent container={props.details.container} />
            <RelatedResourcesSection details={props.details} />

            {container.state === 'running' ? <LiveResourcesSection /> : null}

            <PlatformLabelsSection labels={props.details.container.labels} />
            <JsonViewer
              title='Raw inspect'
              value={props.details.inspect}
            />
          </>
        ) : null}
      </ContainerDetailLayout>

      <ContainerActionDialog />
    </ContainerDetailProvider>
  )
}
