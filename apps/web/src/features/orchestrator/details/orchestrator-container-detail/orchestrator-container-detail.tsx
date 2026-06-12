'use client'

import { Section } from '@/components/ui/section'
import { ContainerActionDialog } from '@/features/orchestrator/details/orchestrator-container-detail/container-action-dialog'
import {
  ContainerDetailProvider,
  useContainerDetailContext
} from '@/features/orchestrator/details/orchestrator-container-detail/container-detail-context'
import { ContainerLogsSection } from '@/features/orchestrator/details/orchestrator-container-detail/container-logs-section'
import { ContainerOverviewSection } from '@/features/orchestrator/details/orchestrator-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/orchestrator/details/orchestrator-container-detail/live-resources-section'
import {
  RelatedImageSection,
  RelatedNetworksSection
} from '@/features/orchestrator/details/orchestrator-container-detail/related-container-sections'
import { PlatformJsonBlock } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const OrchestratorContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  return (
    <ContainerDetailProvider
      details={details}
      initialLogs={initialLogs}
    >
      <OrchestratorContainerDetailContent />
    </ContainerDetailProvider>
  )
}

const OrchestratorContainerDetailContent = () => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ContainerOverviewSection />

        <LiveResourcesSection />

        <div className='grid gap-6 xl:grid-cols-2'>
          <RelatedImageSection />
          <RelatedNetworksSection />
        </div>

        <ContainerLogsSection />

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

      <ContainerActionDialog />
    </>
  )
}
