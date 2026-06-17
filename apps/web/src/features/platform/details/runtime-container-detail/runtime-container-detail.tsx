'use client'

import { Section } from '@/components/ui/section'
import { ContainerActionDialog } from '@/features/platform/details/runtime-container-detail/container-action-dialog'
import {
  ContainerDetailProvider,
  useContainerDetailContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { ContainerLogsSection } from '@/features/platform/details/runtime-container-detail/container-logs-section'
import { ContainerOverviewSection } from '@/features/platform/details/runtime-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/platform/details/runtime-container-detail/live-resources-section'
import {
  RelatedImageSection,
  RelatedNetworksSection
} from '@/features/platform/details/runtime-container-detail/related-container-sections'
import { PlatformJsonBlock } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const RuntimeContainerDetail = ({
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
      <RuntimeContainerDetailContent />
    </ContainerDetailProvider>
  )
}

const RuntimeContainerDetailContent = () => {
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
