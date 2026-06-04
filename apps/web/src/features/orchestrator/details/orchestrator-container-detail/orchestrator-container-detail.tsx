'use client'

import { Section } from '@/components/ui/section'
import { PlatformJsonBlock } from '@/features/orchestrator/components/platform-detail-parts'
import { ContainerActionDialog } from '@/features/orchestrator/details/orchestrator-container-detail/container-action-dialog'
import { ContainerLogsSection } from '@/features/orchestrator/details/orchestrator-container-detail/container-logs-section'
import { ContainerOverviewSection } from '@/features/orchestrator/details/orchestrator-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/orchestrator/details/orchestrator-container-detail/live-resources-section'
import {
  RelatedImageSection,
  RelatedNetworksSection
} from '@/features/orchestrator/details/orchestrator-container-detail/related-container-sections'
import { useContainerDetailController } from '@/features/orchestrator/details/orchestrator-container-detail/use-container-detail-controller'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const OrchestratorContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  const container = details.container
  const relatedImage = details.relatedImage
  const controller = useContainerDetailController({ container, initialLogs })

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ContainerOverviewSection
          container={container}
          onAction={controller.setPendingAction}
        />

        <LiveResourcesSection
          containerState={container.state}
          stats={controller.stats}
          statsError={controller.statsError}
          isRefreshingStats={controller.isRefreshingStats}
          onRefresh={() => void controller.refreshStats()}
        />

        <div className='grid gap-6 xl:grid-cols-2'>
          <RelatedImageSection relatedImage={relatedImage} />
          <RelatedNetworksSection networks={details.relatedNetworks} />
        </div>

        <ContainerLogsSection
          logs={controller.logs}
          isRefreshingLogs={controller.isRefreshingLogs}
          onRefresh={() => void controller.refreshLogs()}
        />

        <Section
          title='Labels'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <PlatformJsonBlock value={container.labels} />
        </Section>

        <Section
          title='Raw inspect'
          boxed
          contentClassName='gap-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </section>

      <ContainerActionDialog
        containerState={container.state}
        forceRemove={controller.forceRemove}
        isActing={controller.isActing}
        pendingAction={controller.pendingAction}
        onForceRemoveChange={controller.setForceRemove}
        onOpenChange={controller.closeActionDialog}
        onRunAction={() => void controller.runAction()}
      />
    </>
  )
}
